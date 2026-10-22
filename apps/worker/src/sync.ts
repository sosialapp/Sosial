/**
 * Unified sync engine (p92). One job per channel:
 *   sync_inbox    — DM conversations + messages → conversations/messages
 *   sync_comments — pages of comments per published post → comments
 *   send_message  — user-initiated DM send (edge function enqueues)
 *   reply_comment — user-initiated comment reply (edge function enqueues)
 *
 * Rules from the spec: official endpoints only (through the adapters),
 * idempotent writes (dedupe by external ids), bell notifications fire on
 * genuinely NEW comment rows only (PostgREST ignore-duplicates returns just
 * the inserted rows), plain-language errors for the UI.
 */
import type { Job } from './db';
import { rest, readSecret } from './db';
import { restPatch } from './rest';
import { adapterFor } from './adapters';
import type { Account, NormalizedComment } from './adapters/types';
import { ensureToken as ensureXToken } from './x';
import { debug, info, warn } from './logger';

/* ----------------------------- channel loading ---------------------------- */

interface DbChannel {
  id: string;
  workspace_id: string;
  provider: string;
  external_id: string;
  instance_url: string | null;
  handle?: string | null;
  display_name?: string | null;
  status?: string;
  metadata: Record<string, any> | null;
  channel_tokens:
    | { access_token_secret_id: string | null; expires_at: string | null }
    | { access_token_secret_id: string | null; expires_at: string | null }[]
    | null;
}

const UNIFIED_PROVIDERS = ['facebook', 'instagram', 'mastodon', 'x', 'bluesky'];

async function loadChannel(channelId: string): Promise<DbChannel | null> {
  const rows = await rest<DbChannel[]>(
    `/rest/v1/connected_channels?id=eq.${encodeURIComponent(channelId)}` +
      `&select=id,workspace_id,provider,external_id,instance_url,handle,display_name,metadata,channel_tokens(access_token_secret_id,expires_at)`,
  );
  return rows?.[0] ?? null;
}

/** Vault-resolved access token, X refreshed on the fly (2h TTL). */
async function channelToken(c: DbChannel): Promise<string> {
  const t = Array.isArray(c.channel_tokens) ? c.channel_tokens[0] : c.channel_tokens;
  if (!t?.access_token_secret_id) {
    throw new Error(`${c.provider} token missing, reconnect the channel.`);
  }
  const secret = await readSecret(t.access_token_secret_id);
  if (!secret) throw new Error(`${c.provider} token unavailable, reconnect the channel.`);
  if (c.provider === 'x') return ensureXToken({
    target: { id: '', provider: 'x', caption: null, options: {}, status: 'inbox' },
    post: { id: '', title: '', body: '' },
    media: [],
    channel: { id: c.id, external_id: c.external_id, instance_url: c.instance_url, metadata: c.metadata ?? {} },
    secrets: { access_secret_id: t.access_token_secret_id, refresh_secret_id: null, expires_at: t.expires_at },
  } as any);
  return secret;
}

function accountOf(c: DbChannel, token: string): Account {
  return {
    id: c.id,
    workspaceId: c.workspace_id,
    provider: c.provider,
    externalId: c.external_id,
    instanceUrl: c.instance_url,
    displayId: c.handle ?? c.display_name ?? null,
    metadata: c.metadata ?? undefined,
    token,
  };
}

/* ------------------------------- REST plumbing ---------------------------- */

async function restInsert<T>(table: string, body: any[], opts?: { onConflict?: string }): Promise<T[]> {
  const qs = opts?.onConflict ? `?on_conflict=${opts.onConflict}` : '';
  const rows = await rest<T[]>(
    `/rest/v1/${table}${qs}`,
    {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
      body: JSON.stringify(body),
    },
  );
  return Array.isArray(rows) ? rows : [];
}

/* -------------------------------- inbox ----------------------------------- */

const INBOX_CONVOS_PER_SWEEP = 50;
const INBOX_PAGES_PER_CONVO = 3;

export async function handleSyncInbox(job: Job): Promise<void> {
  const channelId = String(job.payload?.channel_id ?? '');
  if (!channelId) throw new Error(`job ${job.id}: missing channel_id`);
  debug(`sync_inbox channel ${channelId} (job ${job.id})`);

  const c = await loadChannel(channelId);
  if (!c) { debug(`channel ${channelId} gone`); return; }
  if (c.status && c.status !== 'connected') return;
  if (!UNIFIED_PROVIDERS.includes(c.provider)) {
    throw new Error(
      `Unified Inbox for ${c.provider} is coming in the next release.`,
    );
  }
  const adapter = adapterFor(c.provider);
  const account = accountOf(c, await channelToken(c));

  const page = await adapter.listConversations(account, null);
  const incoming = page.items.slice(0, INBOX_CONVOS_PER_SWEEP);
  if (!incoming.length) return;

  // upsert-ignore: conflicts are live rows, only new ones come back
  const inserted = await restInsert<any>('conversations',
    incoming.map((conv) => ({
      workspace_id: c.workspace_id,
      channel_id: c.id,
      platform: c.provider,
      external_id: conv.externalId,
      participant_name: conv.participantName,
      participant_avatar: conv.participantAvatar,
      last_message_at: conv.lastMessageAt,
      unread_count: conv.unreadCount,
    })), { onConflict: 'platform,external_id' });

  const known = await rest<any[]>(
    `/rest/v1/conversations?channel_id=eq.${encodeURIComponent(c.id)}&platform=eq.${encodeURIComponent(c.provider)}` +
      `&external_id=in.(${incoming.map((cv) => `"${cv.externalId}"`).join(',')})` +
      `&select=id,external_id,cursor,last_message_at,unread_count`,
  );
  const byExternal = new Map<string, any>((known ?? []).map((row) => [row.external_id, row]));
  debug(`sync_inbox channel ${channelId}: ${inserted.length} new, ${known?.length ?? 0} tracked`);

  for (const conv of incoming) {
    const row = byExternal.get(conv.externalId);
    if (!row) continue;
    // Skip unchanged conversations: the newest message is the same one we
    // already stored, so a page fetch would be pure waste (every 5 min).
    const newestAt = conv.lastMessageAt ?? '';
    const storedAt = row.last_message_at ?? '';
    const moved = newestAt !== storedAt || inserted.some((i) => i.external_id === conv.externalId);
    let cursor: string | null = row.cursor ?? null;

    if (moved || cursor) {
      let newMessages: { externalId: string; direction: 'in' | 'out'; body: string; attachments: { url: string }[]; sentAt: string }[] = [];
      for (let p = 0; p < INBOX_PAGES_PER_CONVO; p++) {
        const mp = await adapter.listMessages(account, conv.externalId, cursor);
        if (!mp.items.length) break;
        const stored = await rest<string[]>(
          `/rest/v1/messages?conversation_id=eq.${row.id}&select=external_id&external_id=not.is.null&limit=400`,
        );
        const have = new Set((stored ?? []).map((x) => String(x)));
        newMessages = newMessages.concat(mp.items.filter((m) => !have.has(m.externalId)));
        if (newMessages.length) {
          await restInsert('messages', newMessages.map((m) => ({
            conversation_id: row.id,
            external_id: m.externalId,
            direction: m.direction,
            body: m.body,
            attachments: m.attachments ?? [],
            sent_at: m.sentAt,
            status: 'sent',
          })));
        }
        cursor = mp.cursor;
        await restPatch('conversations', row.id, { cursor });
        if (!cursor) break;
      }
    }

    // Row hygiene: lastMessageAt + unread mirror the platform state.
    await restPatch('conversations', row.id, {
      last_message_at: newestAt || null,
      unread_count: conv.unreadCount,
      participant_name: conv.participantName,
      participant_avatar: conv.participantAvatar,
      synced_at: new Date().toISOString(),
    });
  }
}

/* -------------------------------- comments -------------------------------- */

const COMMENTS_POSTS_PER_SWEEP = 20;

export async function handleSyncComments(job: Job): Promise<void> {
  const channelId = String(job.payload?.channel_id ?? '');
  if (!channelId) throw new Error(`job ${job.id}: missing channel_id`);
  debug(`sync_comments channel ${channelId} (job ${job.id})`);

  const c = await loadChannel(channelId);
  if (!c) { debug(`channel ${channelId} gone`); return; }
  if (c.status && c.status !== 'connected') return;
  if (!UNIFIED_PROVIDERS.includes(c.provider)) {
    throw new Error(
      `Unified comments for ${c.provider} are coming in the next release.`,
    );
  }
  const adapter = adapterFor(c.provider);
  const account = accountOf(c, await channelToken(c));

  // Comment sources = published posts (remote ids). Phase 1 covers the
  // newest 20 posts per sweep; older threads resync on demand.
  const targets = await rest<any[]>(
    `/rest/v1/post_targets?channel_id=eq.${encodeURIComponent(c.id)}&provider=eq.${encodeURIComponent(c.provider)}` +
      `&status=eq.sent&remote_id=not.is.null&select=id,remote_id&limit=${COMMENTS_POSTS_PER_SWEEP}`,
  );

  // Threads to read: posts Sosial published, plus (when the platform lets us
  // enumerate the account timeline) any own post that already has replies -
  // comments on posts published outside Sosial belong in the same inbox.
  const remoteIds = new Set<string>();
  for (const t of targets ?? []) {
    const id = String(t.remote_id ?? '');
    if (id) remoteIds.add(id);
  }
  if (adapter.listOwnPosts) {
    try {
      const own = await adapter.listOwnPosts(account, COMMENTS_POSTS_PER_SWEEP);
      for (const p of own) if (p.commentCount > 0) remoteIds.add(p.externalId);
      debug(`sync_comments channel ${channelId}: ${own.length} own posts, ${remoteIds.size} threads`);
    } catch (e: any) {
      warn(`sync_comments channel ${channelId}: own posts unavailable (${String(e?.message ?? e).slice(0, 120)})`);
    }
  }
  if (!remoteIds.size) { debug(`sync_comments channel ${channelId}: no posts`); return; }

  for (const remoteId of remoteIds) {
    let page = await adapter.listComments(account, remoteId, null);
    let flat = page.items;
    if (page.cursor) { // one extra page — existing threads don't grow that fast
      const more = await adapter.listComments(account, remoteId, page.cursor);
      flat = flat.concat(more.items);
    }
    const rows: NormalizedComment[] = flat.map((cm) => ({
      ...cm,
      externalId: cm.externalId,
      parentExternalId: cm.parentExternalId,
      body: cm.body,
    }));
    if (!rows.length) continue;

    // Unique (platform, external_id): duplicates are live comments, the
    // returned list is exactly the genuinely-new ones. Bell only for these.
    const newRows = await restInsert<any>('comments',
      rows.map((cm) => ({
        workspace_id: c.workspace_id,
        channel_id: c.id,
        platform: c.provider,
        external_post_id: remoteId,
        external_id: cm.externalId,
        parent_external_id: cm.parentExternalId,
        author_name: cm.authorName,
        author_avatar: cm.authorAvatar,
        body: cm.body,
        created_at: cm.createdAt,
        status: 'new',
      })), { onConflict: 'platform,external_id' });

    if (newRows.length) await notifyNewComments(c, newRows);
    debug(`sync_comments channel ${channelId} post ${remoteId}: ${rows.length} seen, ${newRows.length} new`);
  }
}

interface WorkspaceMember { user_id: string }

/** One bell per active member per genuinely-new comment (same as the old
 *  trigger, but only on real inserts so the loop can't re-fire). */
async function notifyNewComments(c: DbChannel, rows: any[]): Promise<void> {
  try {
    const members = await rest<WorkspaceMember[]>(
      `/rest/v1/workspace_members?workspace_id=eq.${encodeURIComponent(c.workspace_id)}&status=eq.active&select=user_id`,
    );
    if (!members?.length) return;
    await restInsert('notifications', rows.flatMap((cm) => members.map((m) => ({
      workspace_id: c.workspace_id,
      user_id: m.user_id,
      kind: 'comment',
      title: `New comment from ${cm.author_name ?? 'someone'}`.slice(0, 120),
      body: String(cm.body ?? '').slice(0, 200),
      href: '/community',
    }))));
  } catch (e) {
    warn(`comment bell failed (channel ${c.id}): ${String(e)}`);
  }
}

/* ------------------------------- send_message ----------------------------- */

export async function handleSendMessage(job: Job): Promise<void> {
  const channelId = String(job.payload?.channel_id ?? '');
  const conversationId = String(job.payload?.conversation_id ?? '');
  const text = String(job.payload?.text ?? '');
  if (!channelId || !conversationId || !text) {
    throw new Error(`job ${job.id}: send_message needs channel_id + conversation_id + text`);
  }
  debug(`send_message conversation ${conversationId} (job ${job.id})`);

  const rows = await rest<any[]>(
    `/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}&select=id,external_id,channel_id,platform,workspace_id`,
  );
  const conv = rows?.[0];
  if (!conv) throw new Error('Conversation no longer exists.');
  const c = await loadChannel(String(conv.channel_id));
  if (!c) throw new Error('Channel disconnected.');
  const adapter = adapterFor(c.provider);
  const account = accountOf(c, await channelToken(c));

  const res = await adapter.sendMessage(account, String(conv.external_id), {
    text,
    attachmentUrls: Array.isArray(job.payload?.attachment_urls)
      ? (job.payload.attachment_urls as unknown[]).filter((u): u is string => typeof u === 'string')
      : undefined,
  });

  await restInsert('messages', [{
    conversation_id: conv.id,
    external_id: res.externalId || null,
    direction: 'out',
    body: text,
    attachments: [],
    sent_at: res.sentAt,
    status: 'sent',
  }]);
  await restPatch('conversations', conv.id, { last_message_at: res.sentAt, cursor: null });
}

/* ------------------------------- reply_comment ---------------------------- */

export async function handleReplyComment(job: Job): Promise<void> {
  const channelId = String(job.payload?.channel_id ?? '');
  const commentId = String(job.payload?.comment_id ?? '');
  const text = String(job.payload?.text ?? '');
  if (!channelId || !commentId || !text) {
    throw new Error(`job ${job.id}: reply_comment needs channel_id + comment_id + text`);
  }
  debug(`reply_comment comment ${commentId} (job ${job.id})`);

  const commentRows = await rest<any[]>(
    `/rest/v1/comments?id=eq.${encodeURIComponent(commentId)}&select=id,external_id,external_post_id,platform,channel_id,workspace_id`,
  );
  const cm = commentRows?.[0];
  if (!cm) throw new Error('Comment no longer exists.');
  const c = await loadChannel(String(cm.channel_id));
  if (!c) throw new Error('Channel disconnected.');
  const adapter = adapterFor(c.provider);
  const account = accountOf(c, await channelToken(c));

  try {
    await adapter.replyToComment(account, String(cm.external_id), { text });
    await restPatch('comments', cm.id, { status: 'replied', synced_at: new Date().toISOString() });
    info(`reply_comment comment ${cm.id}: replied on ${c.provider}`);
  } catch (e: any) {
    throw e;
  }
}
