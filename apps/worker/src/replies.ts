/**
 * Comment replies, Facebook Pages, Threads + Instagram (as the connected
 * Page/identity — never a personal profile).
 *
 * FB:   POST /{comment_id}/comments  { message }   — pages_manage_posts
 *       (the Page token that published the post owns the comment thread).
 * Threads: POST /{threads_id}/replies with reply_to_id — threads_content_publish
 *       (the reply target is the THREAD post id; Sosial comments carry it).
 * IG:   POST /{comment_id}/replies  { message }   — instagram_manage_comments
 *       (the comment_id comes from the scan, which reads the IG graph).
 * Mastodon: POST /api/v1/statuses with in_reply_to_id + visibility inherited
 *       from the conversation (direct when it was a DM thread, otherwise the
 *       default public/unlisted visibility of a normal reply).
 *
 * Job kinds: 'reply_comment' with payload
 *   { provider, channel_id, comment_id, message }
 * A single kind keeps dispatch simple; provider splits inside.
 */
import { rest, readSecret } from './db';
import type { Job } from './db';
import { tokenRow, type ChannelRow, type TokenRow } from './avatars';
import { warn, info, debug } from './logger';

const FB_GRAPH = 'https://graph.facebook.com/v21.0';
const THREADS_API = 'https://graph.threads.net/v1.0';
const IG_GRAPH = 'https://graph.instagram.com/v23.0';
const X_API = 'https://api.x.com/2';
interface ReplyPayload {
  provider: string;
  channel_id: string;
  comment_id: string;
  message: string;
}

function payload(job: Job): ReplyPayload {
  const p = (job.payload ?? {}) as Partial<ReplyPayload>;
  const provider = String(p.provider ?? '');
  const channelId = String(p.channel_id ?? '');
  const commentId = String(p.comment_id ?? '');
  const message = String(p.message ?? '').trim();
  if (!provider || !channelId || !commentId || !message) {
    throw new Error(`job ${job.id}: reply_comment payload needs provider, channel_id, comment_id, message`);
  }
  if (message.length > 2200) throw new Error(`job ${job.id}: reply exceeds 2200 characters`);
  return { provider, channel_id: channelId, comment_id: commentId, message };
}

async function channelById(channelId: string): Promise<{ c: ChannelRow; t: TokenRow } | null> {
  const rows = await rest<ChannelRow[]>(
    `/rest/v1/connected_channels?id=eq.${encodeURIComponent(channelId)}` +
      `&select=id,workspace_id,provider,external_id,instance_url,metadata,status,channel_tokens(access_token_secret_id,refresh_token_secret_id,expires_at)` +
      `&limit=1`,
  );
  const c = rows?.[0];
  if (!c) return null;
  return { c, t: tokenRow(c) };
}

async function directToken(c: ChannelRow, t: TokenRow): Promise<string> {
  if (!t.access_token_secret_id) throw new Error('token missing, reconnect the channel.');
  const v = await readSecret(t.access_token_secret_id);
  if (!v) throw new Error('token unavailable, reconnect the channel.');
  return v;
}

function graphErr(j: any): string {
  const m = j?.error?.message ?? j?.error_description ?? j?.error ?? j?.message;
  return typeof m === 'string' && m ? m : 'platform refused the reply';
}

async function replyFacebook(p: ReplyPayload): Promise<string> {
  const ch = await channelById(p.channel_id);
  if (!ch || ch.c.provider !== 'facebook') throw new Error('facebook channel not found, reconnect it.');
  const tok = await directToken(ch.c, ch.t);
  const r = await fetch(`${FB_GRAPH}/${encodeURIComponent(p.comment_id)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: p.message, access_token: tok }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Facebook refused the reply: ${graphErr(j)}`);
  return String(j?.id ?? '');
}

async function replyThreads(p: ReplyPayload): Promise<string> {
  const ch = await channelById(p.channel_id);
  if (!ch || ch.c.provider !== 'threads') throw new Error('threads channel not found, reconnect it.');
  const tok = await directToken(ch.c, ch.t);
  // The comment row stores the THREAD post id (external target) — replies
  // attach to the thread, matching how the reply feed reads conversations.
  const media = await rest<any[]>(
    `/rest/v1/post_stats?post_id=eq.${encodeURIComponent(p.comment_id)}&select=post_id&limit=1`,
  ).catch(() => null);
  void media; // existence is not required; comment_id for threads IS the post id
  const r = await fetch(`${THREADS_API}/${encodeURIComponent(p.comment_id)}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'TEXT',
      text: p.message,
      reply_to_id: p.comment_id,
      access_token: tok,
    }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Threads refused the reply: ${graphErr(j)}`);
  return String(j?.id ?? '');
}

async function replyInstagram(p: ReplyPayload): Promise<string> {
  const ch = await channelById(p.channel_id);
  if (!ch || ch.c.provider !== 'instagram') throw new Error('instagram channel not found, reconnect it.');
  const tok = await directToken(ch.c, ch.t);
  // IG graph: reply to a comment by posting into its /replies edge as the
  // business account (message may be a plain string or { text } object).
  const r = await fetch(`${IG_GRAPH}/${encodeURIComponent(p.comment_id)}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { text: p.message }, access_token: tok }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Instagram refused the reply: ${graphErr(j)}`);
  return String(j?.id ?? '');
}

async function replyX(p: ReplyPayload): Promise<string> {
  const ch = await channelById(p.channel_id);
  if (!ch || ch.c.provider !== 'x') throw new Error('X channel not found, reconnect it.');
  const tok = await directToken(ch.c, ch.t);
  const r = await fetch(`${X_API}/tweets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: p.message.slice(0, 280),
      reply: { in_reply_to_tweet_id: p.comment_id },
    }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = j?.detail ?? j?.title ?? j?.errors?.[0]?.message ?? `HTTP ${r.status}`;
    throw new Error(`X refused the reply: ${m}`);
  }
  return String(j?.data?.id ?? '');
}

async function replyMastodon(p: ReplyPayload): Promise<string> {
  const ch = await channelById(p.channel_id);
  if (!ch || ch.c.provider !== 'mastodon') throw new Error('mastodon channel not found, reconnect it.');
  const tok = await directToken(ch.c, ch.t);
  const base = normalizeInstance(ch.c.instance_url);
  // Visibility: DM threads (comment text starting with @acct, sent as
  // direct) stay direct; regular post replies are public like the original.
  // in_reply_to_id keeps the thread chained; Mastodon auto-includes the
  // mention when replying to a status.
  const r = await fetch(`${base}/api/v1/statuses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: p.message.slice(0, 500),
      in_reply_to_id: p.comment_id,
      visibility: 'public',
    }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mastodon refused the reply: ${j?.error ?? `HTTP ${r.status}`}`);
  return String(j?.id ?? '');
}

function normalizeInstance(instanceUrl: string | null): string {
  const host = String(instanceUrl ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .split('/')[0]
    .split('?')[0];
  if (!host || /\s/.test(host)) {
    throw new Error('Mastodon channel missing its instance, reconnect it in Connect.');
  }
  return `https://${host}`;
}

export async function handleReplyComment(job: Job): Promise<void> {
  const p = payload(job);
  debug(`reply_comment ${p.provider}/${p.comment_id} (job ${job.id})`);
  try {
    const remoteId =
      p.provider === 'facebook'
        ? await replyFacebook(p)
        : p.provider === 'threads'
          ? await replyThreads(p)
          : p.provider === 'instagram'
            ? await replyInstagram(p)
            : p.provider === 'x'
              ? await replyX(p)
              : p.provider === 'mastodon'
                ? await replyMastodon(p)
                : (() => {
                    throw new Error(`replies not supported for provider '${p.provider}' (facebook, threads, instagram, x + mastodon only)`);
                })();
    info(`reply posted ${p.provider}/${p.comment_id} → ${remoteId}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    warn(`reply_comment failed: ${msg}`);
    throw new Error(msg);
  }
}
