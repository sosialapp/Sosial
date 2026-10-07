import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CAPABILITIES } from '@/lib/compat';

/**
 * Google Sheets content-source logic (server-side). Scope: the minimal
 * `spreadsheets.readonly` (paste-URL flow — no Picker, no drive listing).
 * Tokens live in Vault; refresh runs through the sheets-auth edge fn (the
 * Google client secret never enters the web process). Row → draft mapping,
 * date parsing and validation are pure + unit-tested.
 */

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const MAX_ROWS = 2000;
const MAX_COLS = 40; // A..AN
const CHUNK_ROWS = 100;

export { safeFetchFile } from './mediaFetch';

/* ----------------------------- connections ----------------------------- */

export interface SheetsConnection {
  id: string;
  access_secret_id: string;
  refresh_secret_id: string;
  expires_at: string;
}

export async function getConnection(admin: SupabaseClient, workspaceId: string): Promise<SheetsConnection | null> {
  const { data } = await admin
    .from('sheets_connections')
    .select('id, access_secret_id, refresh_secret_id, expires_at')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return (data as SheetsConnection | null) ?? null;
}

export async function readToken(admin: SupabaseClient, secretId: string): Promise<string | null> {
  const { data } = await admin.rpc('vault_read_secret', { secret_id: secretId });
  return typeof data === 'string' && data ? data : null;
}

/** Fresh access token; refreshes through sheets-auth when stale. */
export async function ensureToken(
  admin: SupabaseClient,
  sb: SupabaseClient,
  workspaceId: string,
): Promise<string | null> {
  const conn = await getConnection(admin, workspaceId);
  if (!conn) return null;
  if (Date.parse(conn.expires_at) > Date.now() + 120_000) {
    return readToken(admin, conn.access_secret_id);
  }
  const refreshToken = await readToken(admin, conn.refresh_secret_id);
  if (!refreshToken) return null;
  const { data, error } = await sb.functions.invoke('sheets-auth', {
    body: { workspace_id: workspaceId, refresh: true },
  });
  const payload = (data ?? {}) as { error?: string };
  if (error || payload.error) return null;
  // The edge fn rotated the Vault secrets; re-read.
  const fresh = await getConnection(admin, workspaceId);
  if (!fresh) return null;
  return readToken(admin, fresh.access_secret_id);
}

/* ------------------------------ API reads ------------------------------ */

async function sheetsGet(token: string, path: string): Promise<any> {
  const res = await fetch(`${SHEETS_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 401 || res.status === 403) {
    throw new SheetsAuthError('Google connection expired. Reconnect your account.');
  }
  if (res.status === 404) {
    throw new SheetsAuthError('That spreadsheet is gone or not shared with this Google account.');
  }
  if (res.status === 429) throw new SheetsRateError();
  if (!res.ok) {
    const j: any = await res.json().catch(() => ({}));
    throw new Error(`Sheets request failed: ${String(j?.error?.message ?? `HTTP ${res.status}`).slice(0, 160)}`);
  }
  return res.json();
}

export class SheetsAuthError extends Error {}
export class SheetsRateError extends Error {}

export async function fetchSpreadsheetMeta(
  token: string,
  spreadsheetId: string,
): Promise<{ id: string; title: string; sheets: { title: string }[] }> {
  const j = await sheetsGet(
    token,
    `/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title)`,
  );
  return {
    id: String(j?.spreadsheetId ?? spreadsheetId),
    title: String(j?.properties?.title ?? 'Spreadsheet'),
    sheets: (j?.sheets ?? []).map((s: any) => ({ title: String(s?.properties?.title ?? 'Sheet') })),
  };
}

/** Chunked row reads — never loads the whole grid at once. */
export async function fetchSheetRows(
  token: string,
  spreadsheetId: string,
  sheetTitle: string,
  startRow: number,
): Promise<{ rows: string[][]; nextStartRow: number | null }> {
  const range = `'${sheetTitle.replace(/'/g, "''")}'!A${startRow}:AN${startRow + CHUNK_ROWS - 1}`;
  const j = await sheetsGet(
    token,
    `/${spreadsheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS`,
  );
  const raw = ((j?.values ?? []) as unknown[][]).map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c))));
  // Google trims trailing empty rows; pad to keep row numbers stable.
  const rows: string[][] = [];
  for (let i = 0; i < CHUNK_ROWS; i++) {
    rows.push(raw[i] ?? []);
  }
  const gotFull = raw.length >= CHUNK_ROWS;
  const next = gotFull && startRow + CHUNK_ROWS - 1 < MAX_ROWS ? startRow + CHUNK_ROWS : null;
  return { rows, nextStartRow: next };
}

/* ------------------------------ date parse ----------------------------- */

/** Offset (minutes) of a zone at a given instant, via Intl. */
export function tzOffsetMinutes(d: Date, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const parts = dtf.formatToParts(d);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
    const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
    return Math.round((asUTC - d.getTime()) / 60000);
  } catch {
    return 0;
  }
}

/**
 * Parse a spreadsheet date cell into an ISO instant.
 * `order` resolves ambiguous numeric dates (01/02/2026).
 * Naive datetimes are interpreted in `timeZone` (wall time).
 */
export function parseSheetDate(value: string, order: 'auto' | 'dmy' | 'mdy', timeZone: string): string | null {
  const v = value.trim();
  if (!v) return null;

  // ISO with time / offset
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})?)?$/);
  if (m) {
    const [, y, mo, d, hh = '0', mi = '0', ss = '0', off] = m;
    if (off && off !== 'Z') {
      const d2 = new Date(v);
      return Number.isNaN(d2.getTime()) ? null : d2.toISOString();
    }
    return buildIso(Number(y), Number(mo), Number(d), Number(hh), Number(mi), Number(ss), off === 'Z' ? 0 : undefined, timeZone);
  }

  // Numeric slash/dot dates: 10/12/2026 or 10.12.2026
  m = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:[T ]+(\d{1,2}):(\d{2}))?$/);
  if (m) {
    const [, a, b, y, hh = '0', mi = '0'] = m;
    let day: number, month: number;
    if (order === 'mdy') { month = Number(a); day = Number(b); }
    else { day = Number(a); month = Number(b); } // dmy + auto → day-first
    return buildIso(Number(y), month, day, Number(hh), Number(mi), 0, undefined, timeZone);
  }

  // 2026/10/10
  m = v.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})(?:[T ]+(\d{1,2}):(\d{2}))?$/);
  if (m) {
    const [, y, mo, d, hh = '0', mi = '0'] = m;
    return buildIso(Number(y), Number(mo), Number(d), Number(hh), Number(mi), 0, undefined, timeZone);
  }

  // "Oct 10, 2026" / "10 Oct 2026" (+ optional time)
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  m = v.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/) ?? v.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) {
    const first = m[1];
    const isNameFirst = Number.isNaN(Number(first));
    const name = (isNameFirst ? first : m[2]).toLowerCase().slice(0, 3);
    const mo = months.indexOf(name) + 1;
    if (mo === 0) return null;
    const day = Number(isNameFirst ? m[2] : m[1]);
    const y = Number(m[3]);
    const hh = Number(m[4] ?? '0');
    const mi = Number(m[5] ?? '0');
    return buildIso(y, mo, day, hh, mi, 0, undefined, timeZone);
  }

  return null;
}

function buildIso(y: number, mo: number, d: number, hh: number, mi: number, ss: number, offsetMin: number | undefined, timeZone: string): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d, hh, mi, ss));
  if (Number.isNaN(dt.getTime()) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const off = offsetMin !== undefined ? offsetMin : tzOffsetMinutes(new Date(dt.getTime() - 60_000), timeZone || 'UTC');
  return new Date(dt.getTime() - off * 60_000).toISOString();
}

/* ------------------------------- mapping ------------------------------- */

export interface SheetsMapping {
  dateCol: number | null;
  platformCol: number | null;
  contentCol: number | null;
  titleCol: number | null;
  mediaCol: number | null;
  statusCol: number | null;
  tagsCol: number | null;
  statusMap: Record<string, 'draft' | 'scheduled'>;
}

export interface SheetsOptions {
  timeZone: string;
  dateOrder: 'auto' | 'dmy' | 'mdy';
  headerRow: number; // 1-based
  /** Worksheet title; carried on options so import jobs are self-contained. */
  sheetTitle?: string;
}

export interface SheetDraft {
  title: string;
  body: string;
  channelIds: string[];
  scheduledAt: string | null;
  tags: string[];
  mediaUrls: string[];
  rowNumber: number;
  contentHash: string;
  warnings: string[];
}

export interface ChannelLite {
  id: string;
  provider: string;
  display_name: string | null;
  handle: string | null;
  label: string;
}

/** Map a platform cell ("linkedin, x") to connected channels; flag the rest. */
export function matchPlatforms(value: string, channels: ChannelLite[]): { ids: string[]; errors: string[] } {
  const errors: string[] = [];
  const tokens = value.split(/[,;/]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0) return { ids: [], errors: ['Platform cell is empty.'] };
  const ids: string[] = [];
  for (const tok of tokens) {
    const matches = channels.filter(
      (c) =>
        c.provider === tok ||
        c.provider.replace(/_/g, '') === tok.replace(/\s+/g, '') ||
        c.label.toLowerCase().replace(/\s+/g, '') === tok.replace(/\s+/g, ''),
    );
    if (matches.length === 1) ids.push(matches[0].id);
    else if (matches.length === 0) errors.push(`Unknown platform "${tok}" — no connected channel matches.`);
    else errors.push(`"${tok}" matches ${matches.length} connected channels — connect only one per network.`);
  }
  return { ids, errors };
}

/** Pure: sheet row + mapping → draft. Errors → ok:false. */
export function mapSheetRow(
  rowNumber: number,
  raw: string[],
  mapping: SheetsMapping,
  options: SheetsOptions,
  channels: ChannelLite[],
): { ok: boolean; draft?: SheetDraft; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const cell = (col: number | null): string => (col === null ? '' : (raw[col] ?? '').trim());

  const body = cell(mapping.contentCol);
  if (!body) errors.push('Content is empty.');

  const channelIds: string[] = [];
  if (mapping.platformCol !== null) {
    const { ids, errors: perr } = matchPlatforms(cell(mapping.platformCol), channels);
    errors.push(...perr);
    channelIds.push(...ids);
  } else if (channels.length === 1) {
    channelIds.push(channels[0].id);
  } else if (channels.length === 0) {
    errors.push('No connected channels in this workspace.');
  } else {
    errors.push('No platform column mapped and the workspace has multiple channels.');
  }

  let scheduledAt: string | null = null;
  const dateCell = cell(mapping.dateCol);
  if (dateCell) {
    const iso = parseSheetDate(dateCell, options.dateOrder, options.timeZone);
    if (!iso) errors.push(`Date "${dateCell}" is not parseable.`);
    else if (new Date(iso).getTime() < Date.now()) errors.push('Scheduled time is in the past.');
    else scheduledAt = iso;
  }
  if (mapping.statusCol !== null) {
    const st = cell(mapping.statusCol);
    if (st) {
      const mapped = mapping.statusMap[st];
      if (mapped === 'draft') scheduledAt = null;
      else if (mapped === 'scheduled' && !scheduledAt) errors.push(`Status "${st}" says scheduled but the date is missing/invalid.`);
      else if (mapped === undefined && !scheduledAt) warnings.push(`Status "${st}" is unmapped — importing as draft.`);
    }
  }

  const mediaUrls: string[] = [];
  const mediaCell = cell(mapping.mediaCol);
  if (mediaCell) {
    for (const u of mediaCell.split(/[\s,]+/)) {
      if (/^https:\/\//i.test(u)) mediaUrls.push(u);
      else if (u) warnings.push(`Media value "${u.slice(0, 60)}" is not an https URL — skipped.`);
    }
  }

  const tags = cell(mapping.tagsCol)
    .split(/[,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const title = (cell(mapping.titleCol) || body.split('\n')[0]).slice(0, 200);

  // Platform text limits (existing capability data, not duplicated).
  for (const cid of channelIds) {
    const ch = channels.find((c) => c.id === cid);
    const max = ch ? CAPABILITIES[ch.provider]?.limits?.text : undefined;
    if (typeof max === 'number' && body.length > max) {
      warnings.push(`Content exceeds the limit for ${ch?.label} (${max} chars).`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const draft: SheetDraft = {
    title,
    body,
    channelIds,
    scheduledAt,
    tags,
    mediaUrls,
    rowNumber,
    contentHash: '',
    warnings,
  };
  draft.contentHash = contentHashOf(draft);
  return { ok: true, draft, errors };
}

export function contentHashOf(d: Pick<SheetDraft, 'title' | 'body' | 'channelIds' | 'scheduledAt' | 'mediaUrls' | 'tags'>): string {
  return createHash('sha256')
    .update(JSON.stringify([d.title, d.body, d.channelIds, d.scheduledAt, d.mediaUrls, d.tags]))
    .digest('hex');
}

/** Auto-suggest column mapping from a header row. */
export function suggestMapping(header: string[]): SheetsMapping {
  const find = (re: RegExp): number | null => {
    const i = header.findIndex((h) => re.test(h.trim().toLowerCase()));
    return i === -1 ? null : i;
  };
  return {
    dateCol: find(/date|when|publish|time|schedule/),
    platformCol: find(/network|platform|channel/),
    contentCol: find(/content|caption|body|text|post|message/) ?? find(/.*/),
    titleCol: find(/title|name|headline/),
    mediaCol: find(/media|image|asset|creative|file|photo|video/),
    statusCol: find(/status|state|stage/),
    tagsCol: find(/tag|label/),
    statusMap: {},
  };
}
