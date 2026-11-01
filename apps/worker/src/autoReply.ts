/**
 * Keyword auto-replies for comments and DMs (p115).
 *
 * The DB triggers only enqueue one `auto_reply` job per new inbound row. This
 * module decides whether a rule matches, applies the guardrails, and then
 * hands the actual send back to the existing `reply_comment` / `send_message`
 * jobs, so every provider adapter, token refresh and retry path stays in one
 * place.
 *
 * The matcher and template renderer are pure and unit-tested (autoReply.test).
 * Everything here is deterministic: no AI, no network call when a rule cannot
 * match.
 */
import type { Job } from './db';
import { rest, callRpc } from './db';
import { restPatch } from './rest';
import { debug, info, warn } from './logger';

export type TargetKind = 'comment' | 'message';
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
  scope: 'comments' | 'messages';
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
}

interface EventRow {
  id: string;
  workspace_id: string;
  rule_id: string | null;
  channel_id: string;
  target_kind: TargetKind;
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
}

/** Comment replies exist on these providers (see reply-comment edge fn). */
const COMMENT_PROVIDERS = new Set([
  'facebook', 'instagram', 'threads', 'mastodon', 'x', 'bluesky', 'youtube',
]);

/** DM sends exist on these providers (Threads/YouTube have no DM surface). */
const MESSAGE_PROVIDERS = new Set([
  'facebook', 'instagram', 'x', 'mastodon', 'bluesky',
]);

/**
 * Per-provider reply length. Comment limits deliberately mirror the platform
 * comment caps, not the post caps (X is the one that bites people). Mastodon
 * defaults to 500 because the instance limit is unknown at this layer.
 */
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

/* ------------------------------ pure matcher ------------------------------ */

/** Lower-case, collapse whitespace and trim. Inputs are never mutated. */
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

/**
 * True when `keyword` appears in `body` under the chosen mode.
 *
 * - word (default): whole word/phrase, so "price" matches "what's the price?"
 *   but not "pricing" or "priced". Unicode letters and digits count as word
 *   characters, punctuation and emoji are boundaries.
 * - contains: raw substring, for people who really want partial matches.
 * - exact: the whole message equals the keyword (ignoring case/whitespace).
 */
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

/** Any/all keywords, each tested with the same mode. Empty lists never match. */
export function matchesKeywords(
  body: string | null | undefined,
  keywords: string[] | null | undefined,
  mode: MatchMode = 'word',
  keywordMode: KeywordMode = 'any',
): boolean {
  const list = (keywords ?? []).map((k) => normalizeMatchText(k)).filter(Boolean);
  if (!list.length) return false;
  if (keywordMode === 'all') {
    return list.every((k) => matchesKeyword(body, k, mode));
  }
  return list.some((k) => matchesKeyword(body, k, mode));
}

export interface TemplateVars {
  name?: string | null;
  handle?: string | null;
  platform?: string | null;
  body?: string | null;
}

/**
 * Replace {{name}}, {{first_name}}, {{handle}}, {{platform}} and {{text}}.
 * Unknown placeholders become an empty string instead of leaking "{{foo}}"
 * into a public reply. Line breaks and emoji in the template are preserved.
 */
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

/** Provider can receive the send at all. */
export function providerCanReply(kind: TargetKind, provider: string): boolean {
  return kind === 'comment' ? COMMENT_PROVIDERS.has(provider) : MESSAGE_PROVIDERS.has(provider);
}

/** Max characters the platform accepts for this reply. */
export function replyLimit(kind: TargetKind, provider: string): number {
  return REPLY_LIMITS[provider]?.[kind] ?? 2000;
}

/* ------------------------------- DB helpers ------------------------------- */

function q(value: string): string {
  return encodeURIComponent(value);
}

function isoSince(minutes: number): string {
  return new Date(Date.now() - Math.max(0, minutes) * 60_000).toISOString();
}

async function loadSettings(workspaceId: string): Promise<AutoReplySettings> {
  const rows = await rest<AutoReplySettings[]>(
    `/rest/v1/auto_reply_settings?workspace_id=eq.${q(workspaceId)}&select=workspace_id,paused,dry_run`,
  );
  return rows?.[0] ?? { workspace_id: workspaceId, paused: false, dry_run: false };
}

async function loadRules(workspaceId: string, scope: 'comments' | 'messages'): Promise<AutoReplyRule[]> {
  const rows = await rest<AutoReplyRule[]>(
    `/rest/v1/auto_reply_rules?workspace_id=eq.${q(workspaceId)}` +
      `&scope=eq.${scope}&enabled=eq.true` +
      `&select=id,workspace_id,name,enabled,dry_run,scope,channel_id,match_mode,keywords,keyword_mode,` +
      `reply_text,delay_seconds,max_age_minutes,daily_cap,per_post_cap,cooldown_minutes,` +
      `first_reply_only,escalate_keywords,priority` +
      `&order=priority.desc,created_at.asc`,
  );
  return Array.isArray(rows) ? rows : [];
}

async function loadRule(ruleId: string): Promise<AutoReplyRule | null> {
  const rows = await rest<AutoReplyRule[]>(
    `/rest/v1/auto_reply_rules?id=eq.${q(ruleId)}&select=*`,
  );
  return rows?.[0] ?? null;
}

async function loadEvent(eventId: string): Promise<EventRow | null> {
  const rows = await rest<EventRow[]>(
    `/rest/v1/auto_reply_events?id=eq.${q(eventId)}&select=*`,
  );
  return rows?.[0] ?? null;
}

async function insertEvent(body: Record<string, unknown>): Promise<EventRow | null> {
  const rows = await rest<EventRow[]>(
    '/rest/v1/auto_reply_events?on_conflict=target_kind,target_id',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
      body: JSON.stringify([body]),
    },
  );
  return rows?.[0] ?? null;
}

async function finish(eventId: string, status: EventRow['status'], reason: string | null): Promise<void> {
  await restPatch('auto_reply_events', eventId, { status, reason });
}

/** Up to `cap` matching event ids. The event being evaluated is excluded. */
async function eventCount(eventId: string, filters: string, cap: number): Promise<number> {
  const limit = Math.max(1, Math.min(cap, 1000));
  const rows = await rest<{ id: string }[]>(
    `/rest/v1/auto_reply_events?${filters}` +
      `&id=neq.${q(eventId)}&status=in.(queued,sent)&select=id&limit=${limit}`,
  );
  return rows?.length ?? 0;
}

/* ------------------------------ target loading ---------------------------- */

interface TargetContext {
  kind: TargetKind;
  id: string;
  workspaceId: string;
  channelId: string;
  platform: string;
  body: string;
  createdAt: string;
  authorName: string | null;
  authorKey: string;
  externalId: string;
  conversationId: string | null;
  participantName: string | null;
  externalPostId: string | null;
  parentExternalId: string | null;
}

async function loadTarget(kind: TargetKind, id: string): Promise<TargetContext | null> {
  if (kind === 'comment') {
    const rows = await rest<any[]>(
      `/rest/v1/comments?id=eq.${q(id)}` +
        `&select=id,workspace_id,channel_id,platform,external_id,external_post_id,parent_external_id,` +
        `author_name,body,created_at,is_own,status`,
    );
    const r = rows?.[0];
    if (!r || r.is_own || r.status !== 'new') return null;
    const authorName = r.author_name ? String(r.author_name) : null;
    return {
      kind,
      id: String(r.id),
      workspaceId: String(r.workspace_id),
      channelId: String(r.channel_id),
      platform: String(r.platform),
      body: String(r.body ?? ''),
      createdAt: String(r.created_at ?? new Date().toISOString()),
      authorName,
      authorKey: authorName ? `name:${normalizeMatchText(authorName)}` : `comment:${r.id}`,
      externalId: String(r.external_id ?? ''),
      conversationId: null,
      participantName: null,
      externalPostId: r.external_post_id ? String(r.external_post_id) : null,
      parentExternalId: r.parent_external_id ? String(r.parent_external_id) : null,
    };
  }

  const rows = await rest<any[]>(
    `/rest/v1/messages?id=eq.${q(id)}&select=id,conversation_id,direction,body,sent_at,status`,
  );
  const m = rows?.[0];
  if (!m || m.direction !== 'in') return null;

  const convRows = await rest<any[]>(
    `/rest/v1/conversations?id=eq.${q(String(m.conversation_id))}` +
      `&select=id,workspace_id,channel_id,platform,external_id,participant_external_id,participant_name`,
  );
  const conv = convRows?.[0];
  if (!conv) return null;

  const participantName = conv.participant_name ? String(conv.participant_name) : null;
  const participantId = conv.participant_external_id
    ? String(conv.participant_external_id)
    : String(conv.id);
  return {
    kind,
    id: String(m.id),
    workspaceId: String(conv.workspace_id),
    channelId: String(conv.channel_id),
    platform: String(conv.platform),
    body: String(m.body ?? ''),
    createdAt: String(m.sent_at ?? new Date().toISOString()),
    authorName: participantName,
    authorKey: `conv:${participantId}`,
    externalId: String(conv.external_id ?? ''),
    conversationId: String(conv.id),
    participantName,
    externalPostId: null,
    parentExternalId: null,
  };
}

interface RulePick {
  rule: AutoReplyRule;
  escalated: boolean;
}

/** First matching rule wins; escalation keywords always win over a match. */
export function pickRule(
  rules: AutoReplyRule[],
  body: string,
  channelId: string,
): RulePick | null {
  const candidates = rules.filter((r) => !r.channel_id || r.channel_id === channelId);
  for (const rule of candidates) {
    if (matchesKeywords(body, rule.escalate_keywords, 'word', 'any')) {
      return { rule, escalated: true };
    }
  }
  for (const rule of candidates) {
    if (matchesKeywords(body, rule.keywords, rule.match_mode, rule.keyword_mode)) {
      return { rule, escalated: false };
    }
  }
  return null;
}

/* -------------------------------- guardrails ------------------------------ */

async function humanAlreadyReplied(target: TargetContext): Promise<boolean> {
  if (target.kind === 'comment') {
    const rows = await rest<{ id: string }[]>(
      `/rest/v1/comments?parent_external_id=eq.${q(target.externalId)}&is_own=eq.true&select=id&limit=1`,
    );
    return !!rows?.length;
  }
  // Only an outbound message newer than this inbound one counts: any older
  // reply in the thread is ordinary history, not a takeover.
  const rows = await rest<{ id: string }[]>(
    `/rest/v1/messages?conversation_id=eq.${q(String(target.conversationId))}` +
      `&direction=eq.out&sent_at=gt.${q(target.createdAt)}&select=id&limit=1`,
  );
  return !!rows?.length;
}

/** True when the target is a reply inside a third-party thread we should not join. */
async function isSomeoneElsesThread(target: TargetContext): Promise<boolean> {
  if (target.kind !== 'comment' || !target.parentExternalId) return false;
  const rows = await rest<{ is_own: boolean }[]>(
    `/rest/v1/comments?platform=eq.${q(target.platform)}` +
      `&external_id=eq.${q(target.parentExternalId)}&select=is_own&limit=1`,
  );
  // Unknown parent: allow (it may be a comment the sweep has not stored yet).
  return !!rows?.length && rows[0].is_own === false;
}

async function forbiddenReason(
  target: TargetContext,
  rule: AutoReplyRule,
  eventId: string,
): Promise<string | null> {
  const ageMs = Date.now() - Date.parse(target.createdAt);
  const ageMinutes = Number.isFinite(ageMs) ? Math.max(0, ageMs / 60_000) : 0;
  if (ageMinutes > rule.max_age_minutes) {
    return `Too old to answer (${Math.round(ageMinutes)} min, limit ${rule.max_age_minutes}).`;
  }

  if (target.kind === 'message' && (target.platform === 'facebook' || target.platform === 'instagram')) {
    // Meta's messaging window: replying outside 24h is rejected by the API.
    if (ageMinutes > 24 * 60) return 'Outside the 24-hour messaging window.';
  }

  if (await isSomeoneElsesThread(target)) {
    return 'Comment is a reply in someone else’s thread.';
  }

  if (await humanAlreadyReplied(target)) {
    return target.kind === 'comment'
      ? 'Your team already replied to this comment.'
      : 'Your team already replied in this conversation.';
  }

  if (rule.first_reply_only && target.kind === 'message') {
    const rows = await rest<{ id: string }[]>(
      `/rest/v1/messages?conversation_id=eq.${q(String(target.conversationId))}` +
        `&direction=eq.out&select=id&limit=1`,
    );
    if (rows?.length) return 'Not the first message in this conversation.';
  }

  const daily = await eventCount(
    eventId,
    `workspace_id=eq.${q(target.workspaceId)}&rule_id=eq.${q(rule.id)}` +
      `&created_at=gte.${q(isoSince(24 * 60))}`,
    rule.daily_cap,
  );
  if (daily >= rule.daily_cap) return `Daily limit reached (${rule.daily_cap}).`;

  if (target.kind === 'comment' && target.externalPostId) {
    const perPost = await eventCount(
      eventId,
      `workspace_id=eq.${q(target.workspaceId)}&channel_id=eq.${q(target.channelId)}` +
        `&external_post_id=eq.${q(target.externalPostId)}&created_at=gte.${q(isoSince(24 * 60))}`,
      rule.per_post_cap,
    );
    if (perPost >= rule.per_post_cap) return `Per-post limit reached (${rule.per_post_cap}).`;
  }

  if (rule.cooldown_minutes > 0) {
    const recent = await eventCount(
      eventId,
      `workspace_id=eq.${q(target.workspaceId)}&author_key=eq.${q(target.authorKey)}` +
        `&created_at=gte.${q(isoSince(rule.cooldown_minutes))}`,
      1,
    );
    if (recent >= 1) return `Cooldown active for this person (${rule.cooldown_minutes} min).`;
  }

  return null;
}

/* ------------------------------- job handler ------------------------------ */

export async function handleAutoReply(job: Job): Promise<void> {
  const kind = String(job.payload?.target_kind ?? '') as TargetKind;
  const targetId = String(job.payload?.target_id ?? '');
  if ((kind !== 'comment' && kind !== 'message') || !targetId) {
    throw new Error(`job ${job.id}: auto_reply needs target_kind + target_id`);
  }

  const target = await loadTarget(kind, targetId);
  if (!target) {
    debug(`auto_reply ${kind} ${targetId}: gone, handled or not inbound`);
    return;
  }

  const settings = await loadSettings(target.workspaceId);
  if (settings.paused) {
    debug(`auto_reply ${kind} ${targetId}: workspace paused`);
    return;
  }

  const rules = await loadRules(target.workspaceId, kind === 'comment' ? 'comments' : 'messages');
  if (!rules.length) return;

  const pick = pickRule(rules, target.body, target.channelId);
  if (!pick) return;

  if (!providerCanReply(kind, target.platform)) {
    debug(`auto_reply ${kind} ${targetId}: ${target.platform} cannot receive replies`);
    return;
  }

  // Plan gate lives in the worker too: web UI being paid is not enough.
  let plan = 'free';
  try {
    plan = String(await callRpc<string>('workspace_plan', { p_workspace_id: target.workspaceId }) ?? 'free');
  } catch (e: any) {
    warn(`auto_reply: plan read failed (${String(e?.message ?? e).slice(0, 120)})`);
  }
  if (!plan || plan === 'free') {
    debug(`auto_reply ${kind} ${targetId}: free plan, skipping`);
    return;
  }

  const replyText = String(pick.rule.reply_text ?? '').trim();
  if (!replyText) return;

  const rendered = renderTemplate(replyText, {
    name: target.authorName,
    handle: target.authorName,
    platform: target.platform,
    body: target.body,
  });
  let sendText = rendered;

  let event = await insertEvent({
    workspace_id: target.workspaceId,
    rule_id: pick.rule.id,
    channel_id: target.channelId,
    target_kind: kind,
    target_id: target.id,
    conversation_id: target.conversationId,
    external_post_id: target.externalPostId,
    external_id: target.externalId,
    author_key: target.authorKey,
    target_preview: target.body.slice(0, 280),
    status: 'queued',
    reason: null,
    reply_text: rendered,
  });

  if (!event) {
    // Another run already claimed this target. A crashed run leaves it queued
    // without a job; those are safe to resume, finished ones are not.
    event = await loadEventByTarget(kind, target.id);
    if (!event) return;
    if (event.status !== 'queued' || event.job_id != null) {
      debug(`auto_reply ${kind} ${target.id}: already handled (${event.status})`);
      return;
    }
    if (event.rule_id && event.rule_id !== pick.rule.id) {
      const stored = await loadRule(event.rule_id);
      if (stored) pick.rule = stored;
    }
    sendText = renderTemplate(String(pick.rule.reply_text ?? '').trim(), {
      name: target.authorName,
      handle: target.authorName,
      platform: target.platform,
      body: target.body,
    });
  }

  if (pick.escalated) {
    await finish(event.id, 'skipped', 'Escalation keyword matched, left for a human.');
    return;
  }

  if (settings.dry_run || pick.rule.dry_run) {
    await finish(event.id, 'skipped', 'Dry run, nothing was sent.');
    return;
  }

  const limit = replyLimit(kind, target.platform);
  if (sendText.length > limit) {
    await finish(event.id, 'skipped', `Reply is ${sendText.length - limit} characters over the ${limit} limit.`);
    return;
  }
  if (!sendText) {
    await finish(event.id, 'skipped', 'Reply text is empty after rendering.');
    return;
  }

  try {
    const reason = await forbiddenReason(target, pick.rule, event.id);
    if (reason) {
      await finish(event.id, 'skipped', reason);
      return;
    }
  } catch (e: any) {
    await finish(event.id, 'failed', `Guardrail check failed: ${String(e?.message ?? e).slice(0, 160)}`);
    return;
  }

  const runAt = new Date(Date.now() + Math.max(0, pick.rule.delay_seconds) * 1000).toISOString();
  const sendKind = kind === 'comment' ? 'reply_comment' : 'send_message';
  const payload =
    kind === 'comment'
      ? { channel_id: target.channelId, comment_id: target.id, text: sendText }
      : { channel_id: target.channelId, conversation_id: target.conversationId, text: sendText };

  try {
    await callRpc<number>('enqueue_auto_reply_send', {
      p_event: event.id,
      p_kind: sendKind,
      p_payload: payload,
      p_run_at: runAt,
    });
    info(
      `auto_reply ${kind} ${target.id}: rule "${pick.rule.name}" queued via ${sendKind} at ${runAt}`,
    );
  } catch (e: any) {
    await finish(event.id, 'failed', `Could not queue the reply: ${String(e?.message ?? e).slice(0, 160)}`);
  }
}

async function loadEventByTarget(kind: TargetKind, targetId: string): Promise<EventRow | null> {
  const rows = await rest<EventRow[]>(
    `/rest/v1/auto_reply_events?target_kind=eq.${q(kind)}&target_id=eq.${q(targetId)}&select=*`,
  );
  return rows?.[0] ?? null;
}

/* -------------------------- send-time guard (sync) ------------------------ */

export interface SendGate {
  ok: boolean;
  reason?: string;
}

async function cancelEvent(event: EventRow, reason: string): Promise<SendGate> {
  // Deliberately not swallowed: if the ledger cannot be updated the send job
  // must fail/retry instead of completing and being marked "sent" by the
  // job_queue trigger.
  await finish(event.id, 'canceled', reason);
  return { ok: false, reason };
}

/**
 * Re-check the world right before the delayed send. A teammate answering in
 * the 60-second delay, a paused workspace, a disabled rule or a deleted
 * comment must all win over a queued auto-reply.
 */
export async function autoReplySendAllowed(eventId: string): Promise<SendGate> {
  const event = await loadEvent(eventId);
  if (!event) return { ok: false, reason: 'Auto-reply event no longer exists.' };
  if (event.status !== 'queued') return { ok: false, reason: `Auto-reply is ${event.status}.` };

  const settings = await loadSettings(event.workspace_id);
  if (settings.paused) return cancelEvent(event, 'Automations were paused before sending.');
  if (settings.dry_run) return cancelEvent(event, 'Workspace is in dry-run mode.');

  const plan = String(
    (await callRpc<string>('workspace_plan', { p_workspace_id: event.workspace_id })) ?? 'free',
  );
  if (!plan || plan === 'free') {
    return cancelEvent(event, 'Workspace is no longer on a paid plan.');
  }

  const rule = event.rule_id ? await loadRule(event.rule_id) : null;
  if (!rule) return cancelEvent(event, 'Rule was deleted before sending.');
  if (!rule.enabled) return cancelEvent(event, 'Rule was disabled before sending.');
  if (rule.dry_run) return cancelEvent(event, 'Rule is in dry-run mode.');

  const target = await loadTarget(event.target_kind, event.target_id);
  if (!target) return cancelEvent(event, 'The comment/message is gone or already handled.');

  if (await humanAlreadyReplied(target)) {
    return cancelEvent(event, 'A teammate replied first.');
  }

  return { ok: true };
}
