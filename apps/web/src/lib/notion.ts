import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Notion content-source logic (server-side). All Notion API calls go through
 * `notionFetch` (fixed api.notion.com host, Notion-Version pinned, timeouts,
 * one 429/5xx retry honoring Retry-After). Row → draft mapping + validation
 * are pure functions (unit-tested); media downloads pass `safeFetchFile`.
 * Tokens live in Vault — only secret ids in notion_connections.
 */

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-11';

/* ----------------------------- connections ----------------------------- */

export interface NotionConnection {
  id: string;
  notion_workspace_id: string;
  notion_workspace_name: string;
  access_secret_id: string;
}

export async function getConnection(
  admin: SupabaseClient,
  workspaceId: string,
): Promise<NotionConnection | null> {
  const { data } = await admin
    .from('notion_connections')
    .select('id, notion_workspace_id, notion_workspace_name, access_secret_id')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as NotionConnection | null) ?? null;
}

export async function readToken(admin: SupabaseClient, secretId: string): Promise<string | null> {
  const { data } = await admin.rpc('vault_read_secret', { secret_id: secretId });
  return typeof data === 'string' && data ? data : null;
}

/* ------------------------------ API wrapper ----------------------------- */

export class NotionAuthError extends Error {}
export class NotionRateError extends Error {
  constructor(public retryAfterSeconds: number) {
    super('notion rate limited');
  }
}

async function notionFetch(
  token: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<any> {
  const attempt = async (): Promise<Response> => {
    const res = await fetch(`${NOTION_API}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    return res;
  };
  let res = await attempt();
  if (res.status === 429 || res.status >= 500) {
    const ra = Number(res.headers.get('retry-after') ?? '0');
    if (ra > 0 && ra <= 10) await new Promise((r) => setTimeout(r, ra * 1000));
    res = await attempt();
  }
  if (res.status === 401 || res.status === 403) {
    throw new NotionAuthError('Notion connection expired or revoked. Reconnect your account.');
  }
  if (res.status === 429) {
    throw new NotionRateError(Number(res.headers.get('retry-after') ?? '10'));
  }
  if (!res.ok) {
    const j: any = await res.json().catch(() => ({}));
    const msg = String(j?.message ?? `HTTP ${res.status}`).slice(0, 160);
    if (/Could not find|not found/i.test(msg)) throw new NotionAuthError('That Notion database is gone or no longer shared with Sosial.');
    throw new Error(`Notion request failed: ${msg}`);
  }
  return res.json();
}

/* ------------------------------- discovery ------------------------------ */

export async function searchDatabases(
  token: string,
  query: string,
  cursor?: string,
): Promise<{ databases: { id: string; title: string }[]; nextCursor?: string }> {
  const j = await notionFetch(token, '/search', {
    method: 'POST',
    body: {
      filter: { property: 'object', value: 'database' },
      query: query || undefined,
      page_size: 20,
      start_cursor: cursor || undefined,
    },
  });
  const dbs = (j?.results ?? []).map((r: any) => ({
    id: String(r?.id ?? ''),
    title:
      (r?.title ?? [])
        .map((t: any) => String(t?.plain_text ?? ''))
        .join('')
        .trim() || 'Untitled database',
  }));
  return { databases: dbs.filter((d: { id: string }) => d.id), nextCursor: j?.next_cursor ?? undefined };
}

export async function getDatabaseSchema(token: string, databaseId: string): Promise<{
  id: string;
  title: string;
  properties: { name: string; type: string }[];
}> {
  const uuid = databaseId.replace(/-/g, '');
  const j = await notionFetch(token, `/databases/${uuid}`);
  return {
    id: String(j?.id ?? databaseId),
    title:
      (j?.title ?? [])
        .map((t: any) => String(t?.plain_text ?? ''))
        .join('')
        .trim() || 'Untitled database',
    properties: Object.entries(j?.properties ?? {}).map(([name, p]) => ({
      name,
      type: String((p as any)?.type ?? 'unsupported'),
    })),
  };
}

export async function queryDatabaseRows(
  token: string,
  databaseId: string,
  cursor?: string,
  pageSize = 50,
): Promise<{ rows: NotionRow[]; nextCursor?: string }> {
  const uuid = databaseId.replace(/-/g, '');
  const j = await notionFetch(token, `/databases/${uuid}/query`, {
    method: 'POST',
    body: { page_size: Math.min(pageSize, 100), start_cursor: cursor || undefined },
  });
  const rows = (j?.results ?? []).map((r: any) => ({
    id: String(r?.id ?? ''),
    lastEdited: String(r?.last_edited_time ?? ''),
    properties: (r?.properties ?? {}) as Record<string, any>,
  }));
  return { rows, nextCursor: j?.next_cursor ?? undefined };
}

export interface NotionRow {
  id: string;
  lastEdited: string;
  properties: Record<string, any>;
}

/** Page body as text (bounded) — for mapping content to "page body". */
export async function getPageBodyText(token: string, pageId: string, maxChars = 20000): Promise<string> {
  const out: string[] = [];
  let cursor: string | undefined;
  let chars = 0;
  for (let depth = 0; depth < 3 && chars < maxChars; depth++) {
    const j: any = await notionFetch(token, `/blocks/${pageId.replace(/-/g, '')}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    for (const b of j?.results ?? []) {
      const line = blockText(b);
      if (line) {
        out.push(line);
        chars += line.length + 1;
        if (chars >= maxChars) break;
      }
    }
    cursor = j?.next_cursor;
    if (!cursor) break;
  }
  return out.join('\n').slice(0, maxChars).trim();
}

function blockText(b: any): string {
  if (!b || typeof b !== 'object') return '';
  const type = String(b.type ?? '');
  if (['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'quote', 'callout', 'code', 'toggle'].includes(type)) {
    const arr = b[type]?.rich_text ?? [];
    return arr.map((t: any) => String(t?.plain_text ?? '')).join('');
  }
  return '';
}

/* --------------------------- property readers --------------------------- */

export function notionPlainText(v: any): string {
  if (Array.isArray(v)) return v.map((t) => String(t?.plain_text ?? '')).join('');
  return '';
}

/** Read one property as plain text, or null when the type is unsupported. */
export function readProperty(prop: any): { kind: string; text: string; date?: { start: string; timeZone?: string | null }; files?: { name: string; url: string }[] } | null {
  if (!prop || typeof prop !== 'object') return null;
  const type = String(prop.type ?? '');
  switch (type) {
    case 'title':
      return { kind: 'title', text: notionPlainText(prop.title) };
    case 'rich_text':
      return { kind: 'rich_text', text: notionPlainText(prop.rich_text) };
    case 'select':
      return { kind: 'select', text: String(prop.select?.name ?? '') };
    case 'status':
      return { kind: 'status', text: String(prop.status?.name ?? '') };
    case 'multi_select':
      return { kind: 'multi_select', text: (prop.multi_select ?? []).map((o: any) => String(o?.name ?? '')).join(', ') };
    case 'date':
      return {
        kind: 'date',
        text: String(prop.date?.start ?? ''),
        date: prop.date?.start ? { start: String(prop.date.start), timeZone: prop.date.time_zone ?? null } : undefined,
      };
    case 'url':
      return { kind: 'url', text: String(prop.url ?? '') };
    case 'checkbox':
      return { kind: 'checkbox', text: prop.checkbox ? 'true' : 'false' };
    case 'email':
    case 'phone_number':
      return { kind: type, text: String(prop[type] ?? '') };
    case 'number':
      return { kind: 'number', text: prop.number === null || prop.number === undefined ? '' : String(prop.number) };
    case 'files':
      return {
        kind: 'files',
        text: '',
        files: (prop.files ?? [])
          .map((f: any) =>
            f?.type === 'file' && f?.file?.url
              ? { name: String(f?.name ?? 'file'), url: String(f.file.url) }
              : f?.type === 'external' && f?.external?.url
                ? { name: String(f?.name ?? 'file'), url: String(f.external.url) }
                : null,
          )
          .filter((f: any): f is { name: string; url: string } => !!f),
      };
    default:
      return null; // people, relation, rollup, formula, created_*, etc.
  }
}

/* -------------------------------- mapping ------------------------------- */

export interface NotionMapping {
  content: string | '__page_body__';
  title?: string;
  platform?: string;
  platform_map?: Record<string, string[]>;
  status?: string;
  status_map?: Record<string, 'draft' | 'scheduled'>;
  date?: string;
  media?: string;
  tags?: string;
}

export interface MappedDraft {
  title: string;
  body: string;
  channelIds: string[];
  scheduledAt: string | null;
  tags: string[];
  mediaUrls: string[];
  externalRowId: string;
  contentHash: string;
  warnings: string[];
}

export function parseNotionDate(start: string, timeZone?: string | null): string | null {
  // Notion date.start is ISO (date-only or datetime, maybe with offset).
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return null;
  // Naive datetime: treat as UTC unless Notion gave a named timezone — the
  // user's schedule timezone is set at scheduling time in the app.
  return d.toISOString();
}

/** Pure: one Notion row → draft + warnings. Errors surface as warnings with ok:false. */
export function mapRowToDraft(
  row: NotionRow,
  mapping: NotionMapping,
  bodyText: string | null,
  channels: { id: string; provider: string; display_name: string | null; handle: string | null }[],
): { ok: boolean; draft?: MappedDraft; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const props = row.properties;

  const read = (name?: string) => (name ? readProperty(props[name]) : undefined);
  const unsupported = Object.entries(props)
    .filter(([name, p]) => mappingHas(mapping, name) && readProperty(p) === null)
    .map(([name]) => name);
  if (unsupported.length > 0) {
    warnings.push(`Unsupported property type skipped: ${unsupported.join(', ')}`);
  }

  // Content (mandatory)
  let body = '';
  if (mapping.content === '__page_body__') {
    body = (bodyText ?? '').trim();
  } else {
    const c = read(mapping.content);
    if (c?.kind === 'files') errors.push('Content is mapped to a files property — map it to text or page body.');
    else body = (c?.text ?? '').trim();
  }
  if (!body) errors.push('Content is empty.');

  // Title
  let title = '';
  const t = read(mapping.title);
  if (t) title = t.text.trim();
  if (!title && body) title = body.split('\n')[0].slice(0, 120);

  // Platform → channels
  const channelIds: string[] = [];
  if (mapping.platform) {
    const p = read(mapping.platform);
    const value = p?.text.trim() ?? '';
    if (value) {
      const ids = mapping.platform_map?.[value] ?? [];
      if (ids.length === 0) {
        errors.push(`Platform value "${value}" is not mapped to a channel.`);
      } else {
        const known = channels.filter((c) => ids.includes(c.id) && c);
        if (known.length !== ids.length) errors.push('A mapped channel is not connected anymore.');
        else channelIds.push(...ids);
      }
    } else {
      errors.push('Platform property is empty on this row.');
    }
  } else if (channels.length === 1) {
    channelIds.push(channels[0].id);
  } else if (channels.length === 0) {
    errors.push('No connected channels in this workspace.');
  } else {
    errors.push('No platform mapping configured — map the platform property or connect exactly one channel.');
  }

  // Status → draft/scheduled
  let wantsScheduled = false;
  if (mapping.status) {
    const s = read(mapping.status);
    const value = s?.text.trim() ?? '';
    if (value) {
      const mapped = mapping.status_map?.[value];
      if (mapped === 'scheduled') wantsScheduled = true;
      else if (mapped === 'draft') wantsScheduled = false;
      else warnings.push(`Status value "${value}" is unmapped — importing as draft.`);
    }
  }

  // Date
  let scheduledAt: string | null = null;
  if (mapping.date) {
    const d = read(mapping.date);
    if (d?.date?.start) {
      const iso = parseNotionDate(d.date.start, d.date.timeZone);
      if (!iso) errors.push(`Date "${d.date.start}" is not parseable.`);
      else scheduledAt = iso;
    }
  }
  if (wantsScheduled && !scheduledAt) {
    errors.push('Row maps to scheduled but has no valid date.');
  }
  if (scheduledAt && !wantsScheduled && mapping.status) {
    // date present but status says draft → draft wins (default behavior)
    scheduledAt = null;
  }

  // Media
  const mediaUrls: string[] = [];
  if (mapping.media) {
    const m = read(mapping.media);
    for (const f of m?.files ?? []) mediaUrls.push(f.url);
  }

  // Tags
  const tags: string[] = [];
  if (mapping.tags) {
    const tg = read(mapping.tags);
    if (tg?.text) tags.push(...tg.text.split(',').map((x) => x.trim()).filter(Boolean));
  }

  if (errors.length > 0) return { ok: false, errors };

  const draft: MappedDraft = {
    title: title.slice(0, 200),
    body,
    channelIds,
    scheduledAt,
    tags,
    mediaUrls,
    externalRowId: row.id,
    contentHash: '',
    warnings,
  };
  draft.contentHash = contentHashOf(draft);
  return { ok: true, draft, errors };
}

function mappingHas(mapping: NotionMapping, propName: string): boolean {
  return (
    mapping.content === propName ||
    mapping.title === propName ||
    mapping.platform === propName ||
    mapping.status === propName ||
    mapping.date === propName ||
    mapping.media === propName ||
    mapping.tags === propName
  );
}

export function contentHashOf(d: Pick<MappedDraft, 'title' | 'body' | 'channelIds' | 'scheduledAt' | 'mediaUrls' | 'tags'>): string {
  return createHash('sha256')
    .update(JSON.stringify([d.title, d.body, d.channelIds, d.scheduledAt, d.mediaUrls, d.tags]))
    .digest('hex');
}

/* ------------------------------ media fetch ----------------------------- */

export { safeFetchFile } from './mediaFetch';
