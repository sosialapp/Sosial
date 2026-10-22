/**
 * Threads adapter — comments/replies only. The Threads API exposes no
 * messaging endpoints, so the DM tab stays off and only comments sync.
 * Official endpoints:
 *   Posts:    GET  /<threads-user-id>/threads
 *   Replies:  GET  /<media-id>/replies
 *   Reply:    POST /<threads-user-id>/threads (reply_to_id) → threads_publish
 *   Docs:     https://developers.facebook.com/docs/threads
 *
 * Own replies are kept and flagged `isOwn`, the same as Instagram/Facebook, so
 * a thread reads like the platform thread. `/{post}/replies` only returns the
 * first level, so comments that advertise children get one extra fetch.
 */
import { httpJson, withParams } from './http';
import { isoTime } from './graph';
import { publishOne } from '../threads';
import type {
  Account, Page, NormalizedConversation, NormalizedMessage, NormalizedComment,
  SendResult, Capabilities, InboxAdapter,
} from './types';

const THREADS = 'https://graph.threads.net/v1.0';
const MAX_REPLY = 500;
/** How many comments per page may be expanded into their nested replies. */
const MAX_NESTED_PARENTS = 10;

const selfCache = new Map<string, { username: string | null; at: number }>();
const SELF_TTL_MS = 10 * 60 * 1000;

function threadsError(label: string, data: any, status: number): Error {
  const e = data?.error ?? {};
  const message = String(e.message ?? data?.message ?? `request failed (${status})`);
  if (status === 401 || Number(e.code) === 190) {
    return new Error(
      `${label}: Threads session expired, toggle cloud publishing off and on in Connect to refresh.`,
    );
  }
  return new Error(`${label}: ${message}`);
}

/** Our own username, so our replies can be told apart from visitors'. */
async function ownUsername(account: Account): Promise<string | null> {
  const cached = selfCache.get(account.externalId);
  if (cached && Date.now() - cached.at < SELF_TTL_MS) return cached.username;
  const fallback = (account.displayId ?? '').replace(/^@/, '').trim().toLowerCase() || null;
  const r = await httpJson({
    provider: 'threads',
    url: withParams(`${THREADS}/me`, { fields: 'id,username' }),
    headers: { Authorization: `Bearer ${account.token}` },
  });
  const seen = r.status === 200 || r.status === 201 ? String(r.data?.username ?? '') : '';
  const username = seen ? seen.toLowerCase() : fallback;
  selfCache.set(account.externalId, { username, at: Date.now() });
  return username;
}

function noMessaging(): never {
  throw new Error('Threads has no messaging API — comments only.');
}

export const threads: InboxAdapter = {
  capabilities(): Capabilities {
    return { inbox: false, comments: true, hideComment: false, deleteComment: false };
  },

  async listConversations(): Promise<Page<NormalizedConversation>> {
    noMessaging();
  },

  async listMessages(): Promise<Page<NormalizedMessage>> {
    noMessaging();
  },

  async sendMessage(): Promise<SendResult> {
    noMessaging();
  },

  async listComments(account, postId, cursor): Promise<Page<NormalizedComment>> {
    const fields = 'id,text,timestamp,username,name,profile_picture_url,replied_to,has_replies';
    const url = withParams(`${THREADS}/${postId}/replies`, {
      fields,
      limit: 100,
      after: cursor ?? undefined,
    });
    const r = await httpJson({ url, provider: 'threads', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw threadsError('Threads replies', r.data, r.status);
    const me = await ownUsername(account);

    const toComment = (c: any): NormalizedComment => {
      const repliedTo = c?.replied_to?.id ? String(c.replied_to.id) : '';
      return {
        externalId: String(c.id),
        // A reply aimed at the post itself is a root in the inbox; only a
        // reply aimed at another comment nests under it.
        parentExternalId: repliedTo && repliedTo !== postId ? repliedTo : null,
        authorName: c?.username
          ? `@${String(c.username).replace(/^@/, '')}`
          : c?.name
            ? String(c.name)
            : 'Threads user',
        authorAvatar: c?.profile_picture_url ?? null,
        body: typeof c?.text === 'string' ? c.text : '',
        createdAt: isoTime(c?.timestamp ?? new Date().toISOString()),
        isOwn: !!me && String(c?.username ?? '').toLowerCase() === me,
      };
    };

    const top = Array.isArray(r.data?.data) ? r.data.data : [];
    const items: NormalizedComment[] = top.map(toComment);

    // Replies to replies live one level deeper and never appear in the
    // post's own reply list, so walk down for the comments that have
    // children (bounded: the Threads API allows 5 calls/s per account).
    const parents = top.filter((c: any) => c?.has_replies).slice(0, MAX_NESTED_PARENTS);
    for (const parent of parents) {
      try {
        const nested = await httpJson({
          url: withParams(`${THREADS}/${parent.id}/replies`, { fields, limit: 50 }),
          provider: 'threads',
          headers: { Authorization: `Bearer ${account.token}` },
        });
        if (nested.status !== 200 && nested.status !== 201) continue;
        for (const c of Array.isArray(nested.data?.data) ? nested.data.data : []) {
          items.push(toComment(c));
        }
      } catch {
        // One unreadable branch must not hide the rest of the thread.
      }
    }

    return { items, cursor: r.data?.paging?.cursors?.after ?? null };
  },

  /** Newest own threads, including ones published outside Sosial. The API
   *  only exposes a boolean (`has_replies`), which is all the sweep needs:
   *  posts without replies are skipped. */
  async listOwnPosts(account, limit) {
    const url = withParams(`${THREADS}/${account.externalId}/threads`, {
      fields: 'id,has_replies',
      limit: Math.max(1, Math.min(limit, 50)),
    });
    const r = await httpJson({ url, provider: 'threads', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw threadsError('Threads posts', r.data, r.status);
    return (r.data?.data ?? []).map((p: any) => ({
      externalId: String(p.id),
      commentCount: p?.has_replies ? 1 : 0,
    }));
  },

  async replyToComment(account, commentId, content): Promise<SendResult> {
    const text = content.text.trim();
    if (!text) throw new Error('Threads reply is empty.');
    if (text.length > MAX_REPLY) {
      throw new Error(`Threads replies are limited to ${MAX_REPLY} characters.`);
    }
    // Replies are containers with reply_to_id, then published — same flow as
    // a normal post, so the publish adapter's retry/status handling is reused.
    const externalId = await publishOne({
      threadsId: account.externalId,
      token: account.token,
      text,
      kind: 'TEXT',
      replyToId: commentId,
    });
    return { externalId, sentAt: new Date().toISOString() };
  },
};
