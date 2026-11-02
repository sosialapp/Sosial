/**
 * Keyword auto-reply rules (p115), web mirror.
 *
 * The matcher, template renderer and provider limits MUST stay identical to
 * apps/worker/src/autoReply.ts: the UI test box shows what the worker will
 * actually do. Change both files together.
 */

export type AutoReplyScope = 'comments' | 'messages';
export type MatchMode = 'word' | 'contains' | 'exact';
export type KeywordMode = 'any' | 'all';

export interface AutoReplySettings {
  workspace_id: string;
  paused: boolean;
  dry_run: boolean;
}

export interface AutoReplyRule {
  id: string;
  workspace_id: string;
  name: string;
  enabled: boolean;
  dry_run: boolean;
  scope: AutoReplyScope;
  channel_id: string | null;
  match_mode: MatchMode;
  keywords: string[];
  keyword_mode: KeywordMode;
  reply_text: string;
  delay_seconds: number;
  max_age_minutes: number;
  daily_cap: number;
  per_post_cap: number;
  cooldown_minutes: number;
  first_reply_only: boolean;
  escalate_keywords: string[];
  priority: number;
  created_at?: string;
  updated_at?: string;
}

export interface AutoReplyEventRow {
  id: string;
  workspace_id: string;
  rule_id: string | null;
  channel_id: string;
  target_kind: 'comment' | 'message';
  target_id: string;
  conversation_id: string | null;
  external_post_id: string | null;
  external_id: string | null;
  author_key: string | null;
  target_preview: string | null;
  status: 'queued' | 'sent' | 'skipped' | 'failed' | 'canceled';
  reason: string | null;
  reply_text: string | null;
  job_id: number | null;
  created_at: string;
  sent_at: string | null;
}

export interface AutoReplyChannel {
  id: string;
  provider: string;
  handle: string | null;
  display_name: string | null;
  status: string;
  /** Avatar sync output (metadata.avatar), for ChannelAvatar. */
  metadata?: Record<string, unknown> | null;
}

const COMMENT_PROVIDERS = new Set([
  'facebook', 'instagram', 'threads', 'mastodon', 'x', 'bluesky', 'youtube',
]);
const MESSAGE_PROVIDERS = new Set(['facebook', 'instagram', 'x', 'mastodon', 'bluesky']);

const REPLY_LIMITS: Record<string, { comment: number; message: number }> = {
  facebook: { comment: 8000, message: 2000 },
  instagram: { comment: 2200, message: 1000 },
  threads: { comment: 500, message: 500 },
  x: { comment: 280, message: 10000 },
  bluesky: { comment: 300, message: 1000 },
  mastodon: { comment: 500, message: 500 },
  youtube: { comment: 10000, message: 10000 },
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
  x: 'X',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  youtube: 'YouTube',
};

export const MATCH_MODES: { value: MatchMode; label: string; hint: string }[] = [
  { value: 'word', label: 'Mentions the word', hint: '“price” matches “what’s the price?” but not “pricing”.' },
  { value: 'contains', label: 'Contains text', hint: 'Raw substring: “pric” also matches “pricing”.' },
  { value: 'exact', label: 'Is exactly', hint: 'The whole message must equal the keyword.' },
];

export const SCOPES: { value: AutoReplyScope; label: string }[] = [
  { value: 'comments', label: 'Comments' },
  { value: 'messages', label: 'Direct messages' },
];

export function normalizeMatchText(input: string | null | undefined): string {
  return String(input ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchesKeyword(
  body: string | null | undefined,
  keyword: string | null | undefined,
  mode: MatchMode = 'word',
): boolean {
  const haystack = normalizeMatchText(body);
  const needle = normalizeMatchText(keyword);
  if (!haystack || !needle) return false;
  if (mode === 'contains') return haystack.includes(needle);
  if (mode === 'exact') return haystack === needle;
  const re = new RegExp(
    `(^|[^\\p{L}\\p{N}_])${escapeRegExp(needle)}($|[^\\p{L}\\p{N}_])`,
    'u',
  );
  return re.test(haystack);
}

export function matchesKeywords(
  body: string | null | undefined,
  keywords: string[] | null | undefined,
  mode: MatchMode = 'word',
  keywordMode: KeywordMode = 'any',
): boolean {
  const list = (keywords ?? []).map((k) => normalizeMatchText(k)).filter(Boolean);
  if (!list.length) return false;
  if (keywordMode === 'all') return list.every((k) => matchesKeyword(body, k, mode));
  return list.some((k) => matchesKeyword(body, k, mode));
}

export interface TemplateVars {
  name?: string | null;
  handle?: string | null;
  platform?: string | null;
  body?: string | null;
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  const name = String(vars.name ?? '').trim();
  const handle = String(vars.handle ?? '').trim() || name;
  const values: Record<string, string> = {
    name,
    first_name: name.split(/\s+/)[0] ?? '',
    handle,
    username: handle,
    platform: PLATFORM_LABELS[String(vars.platform ?? '')] ?? String(vars.platform ?? ''),
    text: String(vars.body ?? '').trim(),
  };
  return template
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => values[key.toLowerCase()] ?? '')
    .trim();
}

export function providerCanReply(kind: 'comment' | 'message', provider: string): boolean {
  return kind === 'comment' ? COMMENT_PROVIDERS.has(provider) : MESSAGE_PROVIDERS.has(provider);
}

export function replyLimit(kind: 'comment' | 'message', provider: string): number {
  return REPLY_LIMITS[provider]?.[kind] ?? 2000;
}

export function channelLabel(ch: AutoReplyChannel): string {
  const name = ch.display_name || ch.handle || ch.provider;
  return `${PLATFORM_LABELS[ch.provider] ?? ch.provider} · ${name}`;
}

/* -------------------------------- validation ------------------------------- */

export interface RuleInput {
  name: unknown;
  enabled?: unknown;
  dry_run?: unknown;
  scope: unknown;
  channel_id?: unknown;
  match_mode?: unknown;
  keywords?: unknown;
  keyword_mode?: unknown;
  reply_text: unknown;
  delay_seconds?: unknown;
  max_age_minutes?: unknown;
  daily_cap?: unknown;
  per_post_cap?: unknown;
  cooldown_minutes?: unknown;
  first_reply_only?: unknown;
  escalate_keywords?: unknown;
  priority?: unknown;
}

export type RuleValues = Omit<AutoReplyRule, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>;

export type RuleValidation =
  | { ok: true; value: RuleValues }
  | { ok: false; error: string };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function int(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(max, Math.max(min, n)));
}

function keywordList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    const k = text(raw).replace(/\s+/g, ' ');
    if (!k) continue;
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k.slice(0, 100));
    if (out.length >= max) break;
  }
  return out;
}

/** Server + client validation; the DB constraints are the final backstop. */
export function validateRuleInput(input: RuleInput): RuleValidation {
  const name = text(input.name);
  if (!name) return { ok: false, error: 'Give the rule a name.' };
  if (name.length > 80) return { ok: false, error: 'Rule names are limited to 80 characters.' };

  const scope: AutoReplyScope = input.scope === 'messages' ? 'messages' : 'comments';
  const match_mode: MatchMode =
    input.match_mode === 'contains' || input.match_mode === 'exact' ? input.match_mode : 'word';
  const keyword_mode: KeywordMode = input.keyword_mode === 'all' ? 'all' : 'any';

  const keywords = keywordList(input.keywords, 50);
  if (!keywords.length) return { ok: false, error: 'Add at least one keyword.' };

  const escalate_keywords = keywordList(input.escalate_keywords, 20);

  const reply_text = text(input.reply_text);
  if (!reply_text) return { ok: false, error: 'Write the reply that should be sent.' };
  if (reply_text.length > 5000) return { ok: false, error: 'Replies are limited to 5,000 characters.' };

  const channel_id = text(input.channel_id) || null;

  return {
    ok: true,
    value: {
      name,
      enabled: bool(input.enabled, true),
      dry_run: bool(input.dry_run, false),
      scope,
      channel_id,
      match_mode,
      keywords,
      keyword_mode,
      reply_text,
      delay_seconds: int(input.delay_seconds, 60, 0, 3600),
      max_age_minutes: int(input.max_age_minutes, 60, 1, 10080),
      daily_cap: int(input.daily_cap, 50, 1, 1000),
      per_post_cap: int(input.per_post_cap, 20, 1, 500),
      cooldown_minutes: int(input.cooldown_minutes, 1440, 0, 43200),
      first_reply_only: bool(input.first_reply_only, false),
      escalate_keywords,
      priority: int(input.priority, 0, -100, 100),
    },
  };
}

export const DEFAULT_RULE: RuleValues = {
  name: '',
  enabled: true,
  dry_run: true,
  scope: 'comments',
  channel_id: null,
  match_mode: 'word',
  keywords: [],
  keyword_mode: 'any',
  reply_text: '',
  delay_seconds: 60,
  max_age_minutes: 60,
  daily_cap: 50,
  per_post_cap: 20,
  cooldown_minutes: 1440,
  first_reply_only: false,
  escalate_keywords: [],
  priority: 0,
};
