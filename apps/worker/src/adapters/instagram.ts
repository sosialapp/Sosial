/**
 * Instagram adapter — business DM + comments through the Instagram Platform
 * API with Instagram Login (official endpoints). Token = Instagram user access
 * token in Vault (`instagram_business_basic`,
 * `instagram_business_content_publish`, `instagram_business_manage_comments`,
 * `instagram_business_manage_messages`).
 *   Overview:      https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 *   Messaging:     GET /<IG_ID>/conversations, POST /<IG_ID>/messages
 *   Comments:      GET /<MEDIA_ID>/comments, POST /<COMMENT_ID>/replies
 */
import { httpJson, withParams } from './http';
import { attachmentType, attachmentUrls, isoTime, metaError } from './graph';
import type {
  Account, Page, NormalizedConversation, NormalizedMessage, NormalizedComment,
  SendResult, Capabilities, InboxAdapter,
} from './types';

const GRAPH = 'https://graph.instagram.com/v23.0';

// `/me` returns the app-scoped id, but participants and message senders carry
// the professional account id (`user_id`). Without both we mistake our own
// account for the other side of every thread.
const selfCache = new Map<string, { ids: string[]; at: number }>();
const SELF_TTL_MS = 10 * 60 * 1000;

async function selfIds(account: Account): Promise<string[]> {
  const cached = selfCache.get(account.externalId);
  if (cached && Date.now() - cached.at < SELF_TTL_MS) return cached.ids;
  const ids = [String(account.externalId)];
  const r = await httpJson({
    provider: 'instagram',
    url: withParams(`${GRAPH}/me`, { fields: 'id,user_id,username' }),
    headers: { Authorization: `Bearer ${account.token}` },
  });
  if ((r.status === 200 || r.status === 201) && r.data?.user_id) {
    ids.push(String(r.data.user_id));
    selfCache.set(account.externalId, { ids, at: Date.now() });
  }
  return ids;
}

export const instagram: InboxAdapter = {
  capabilities(): Capabilities {
    return { inbox: true, comments: true, hideComment: true, deleteComment: true };
  },

  async listConversations(account, cursor): Promise<Page<NormalizedConversation>> {
    // Only the documented fields: unread_count/snippet/message_count are
    // Messenger-only and make this edge fail with #100.
    const url = withParams(`${GRAPH}/${account.externalId}/conversations`, {
      platform: 'instagram',
      fields: 'id,updated_time,participants{id,username}',
      limit: 25,
      after: cursor ?? undefined,
    });
    const r = await httpJson({ url, provider: 'instagram', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw metaError('Instagram messages', r.data, r.status);
    const self = await selfIds(account);
    const items: NormalizedConversation[] = (r.data?.data ?? []).map((c: any): NormalizedConversation => {
      const other = (c?.participants?.data ?? []).find(
        (p: any) => !self.includes(String(p?.id ?? '')),
      );
      const handle = other?.username ? `@${String(other.username).replace(/^@/, '')}` : null;
      return {
        externalId: String(c.id),
        participantExternalId: other?.id ? String(other.id) : null,
        participantName: handle ?? 'Instagram user',
        participantAvatar: null,
        lastMessageAt: isoTime(c?.updated_time ?? new Date().toISOString()),
        // Derived from inbound/outbound rows by the sync engine.
        unreadCount: 0,
      };
    });
    return { items, cursor: r.data?.paging?.cursors?.after ?? null };
  },

  async listMessages(account, conversationId, cursor): Promise<Page<NormalizedMessage>> {
    const url = withParams(`${GRAPH}/${conversationId}/messages`, {
      fields: 'id,created_time,from{id,username},message,attachments',
      limit: 50,
      after: cursor ?? undefined,
    });
    const r = await httpJson({ url, provider: 'instagram', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw metaError('Instagram thread', r.data, r.status);
    const self = await selfIds(account);
    const items: NormalizedMessage[] = (r.data?.data ?? [])
      .map((m: any): NormalizedMessage => ({
        externalId: String(m.id),
        direction: self.includes(String(m?.from?.id ?? '')) ? 'out' : 'in',
        body: typeof m.message === 'string' ? m.message : '',
        attachments: attachmentUrls(m.attachments),
        sentAt: isoTime(m?.created_time ?? new Date().toISOString()),
      }))
      .reverse();
    return { items, cursor: r.data?.paging?.cursors?.after ?? null };
  },

  async sendMessage(account, _conversationId, content, recipientId): Promise<SendResult> {
    // Instagram Send API is recipient-scoped (IGSID), never conversation id.
    if (!recipientId) {
      throw new Error(
        'Instagram send: this conversation has no Instagram user id yet — run a sync and try again.',
      );
    }
    const attach = content.attachmentUrls?.[0];
    const body: Record<string, unknown> = {
      recipient: { id: String(recipientId) },
      message: {
        text: content.text,
        ...(attach ? { attachment: { type: attachmentType(attach), payload: { url: attach } } } : {}),
      },
    };
    const r = await httpJson({
      provider: 'instagram',
      method: 'POST',
      url: `${GRAPH}/${account.externalId}/messages`,
      headers: { Authorization: `Bearer ${account.token}` },
      body,
    });
    if (r.status !== 200 && r.status !== 201) throw metaError('Instagram send', r.data, r.status);
    return { externalId: String(r.data?.message_id ?? ''), sentAt: new Date().toISOString() };
  },

  async listComments(account, postId, cursor): Promise<Page<NormalizedComment>> {
    const url = withParams(`${GRAPH}/${postId}/comments`, {
      // Graph paging for this edge uses `after` like the rest; keep one
      // canonical cursor path to avoid double-counting params.
      fields: 'id,text,timestamp,username,hidden,replies{id,text,timestamp,username,hidden}',
      limit: 50,
      after: cursor ?? undefined,
    });
    const r = await httpJson({ url, provider: 'instagram', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw metaError('Instagram comments', r.data, r.status);
    const mine = String(account.displayId ?? '').replace(/^@/, '');
    const items: NormalizedComment[] = [];
    for (const c of r.data?.data ?? []) {
      items.push({
        externalId: String(c.id),
        parentExternalId: null,
        authorName: c?.username ? `@${c.username}` : 'Instagram user',
        authorAvatar: null,
        body: typeof c.text === 'string' ? c.text : '',
        createdAt: isoTime(c?.timestamp ?? new Date().toISOString()),
        isOwn: !!mine && String(c?.username ?? '') === mine,
      });
      for (const rep of Array.isArray(c?.replies?.data) ? c.replies.data : []) {
        items.push({
          externalId: String(rep.id),
          parentExternalId: String(c.id),
          authorName: rep?.username ? `@${rep.username}` : 'Instagram user',
          authorAvatar: null,
          body: typeof rep.text === 'string' ? rep.text : '',
          createdAt: isoTime(rep?.timestamp ?? new Date().toISOString()),
          isOwn: !!mine && String(rep?.username ?? '') === mine,
        });
      }
    }
    return { items, cursor: r.data?.paging?.cursors?.after ?? null };
  },

  /** Newest media (including posts published outside Sosial), so their
   *  comment threads enter the inbox too. */
  async listOwnPosts(account, limit) {
    const url = withParams(`${GRAPH}/${account.externalId}/media`, {
      fields: 'id,comments_count,timestamp',
      limit: Math.max(1, Math.min(limit, 50)),
    });
    const r = await httpJson({ url, provider: 'instagram', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw metaError('Instagram media', r.data, r.status);
    return (r.data?.data ?? []).map((m: any) => ({
      externalId: String(m.id),
      commentCount: Number(m?.comments_count ?? 0),
    }));
  },

  async replyToComment(account, commentId, content): Promise<SendResult> {
    const r = await httpJson({
      provider: 'instagram',
      method: 'POST',
      url: `${GRAPH}/${commentId}/replies`,
      headers: { Authorization: `Bearer ${account.token}` },
      body: { message: content.text },
    });
    if (r.status !== 200 && r.status !== 201) throw metaError('Instagram reply', r.data, r.status);
    return { externalId: String(r.data?.id ?? ''), sentAt: new Date().toISOString() };
  },
};

export const instagramCommentExtras = {
  async hide(account: Account, commentId: string): Promise<void> {
    const r = await httpJson({
      provider: 'instagram',
      method: 'POST',
      url: `${GRAPH}/${commentId}`,
      headers: { Authorization: `Bearer ${account.token}` },
      body: { hide: true },
    });
    if (r.status !== 200 && r.status !== 201) throw metaError('Instagram hide', r.data, r.status);
  },
  async remove(account: Account, commentId: string): Promise<void> {
    const r = await httpJson({
      provider: 'instagram',
      method: 'DELETE',
      url: `${GRAPH}/${commentId}`,
      headers: { Authorization: `Bearer ${account.token}` },
    });
    if (r.status !== 200 && r.status !== 201) throw metaError('Instagram delete', r.data, r.status);
  },
};
