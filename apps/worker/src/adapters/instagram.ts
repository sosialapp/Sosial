/**
 * Instagram adapter — business DM + comments through the Instagram Platform
 * API (official endpoints). Token = Instagram user access token in Vault
 * (`instagram_business_basic`, `instagram_business_content_publish`,
 * `instagram_business_manage_comments`, `instagram_business_manage_insights`;
 * DMs additionally need `instagram_manage_messages` + "Allow Access to
 * Messages" + App Review).
 *   Overview:      https://developers.facebook.com/docs/instagram-messaging/overview
 *   Send:          https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message
 *   Comments:      GET/POST /{comment-id}/replies edge
 */
import { httpJson, httpError, withParams } from './http';
import type {
  Account, Page, NormalizedConversation, NormalizedMessage, NormalizedComment,
  SendResult, Capabilities, InboxAdapter,
} from './types';

const GRAPH = 'https://graph.instagram.com/v23.0';

export const instagram: InboxAdapter = {
  capabilities(): Capabilities {
    return { inbox: true, comments: true, hideComment: true, deleteComment: true };
  },

  async listConversations(account, cursor): Promise<Page<NormalizedConversation>> {
    const url = withParams(`${GRAPH}/${account.externalId}/conversations`, {
      platform: 'instagram',
      fields: 'id,updated_time,message_count,participants,snippet,unread_count',
      limit: 25,
      after: cursor ?? undefined,
    });
    const r = await httpJson({ url, provider: 'instagram', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw httpError('Instagram messages', r.data, r.status);
    const items: NormalizedConversation[] = (r.data?.data ?? []).map((c: any): NormalizedConversation => {
      const me = account.externalId;
      const other = (c?.participants?.data ?? []).find((p: any) => String(p?.id ?? '') !== me);
      return {
        externalId: String(c.id),
        participantName: other?.username ?? other?.name ?? 'Instagram user',
        participantAvatar: null,
        lastMessageAt: c?.updated_time ?? new Date().toISOString(),
        unreadCount: Number(c?.unread_count ?? 0),
      };
    });
    return { items, cursor: r.data?.paging?.cursors?.after ?? null };
  },

  async listMessages(account, conversationId, cursor): Promise<Page<NormalizedMessage>> {
    const url = withParams(`${GRAPH}/${conversationId}/messages`, {
      fields: 'id,created_time,from,message,attachments',
      limit: 50,
      after: cursor ?? undefined,
    });
    const r = await httpJson({ url, provider: 'instagram', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw httpError('Instagram thread', r.data, r.status);
    const items: NormalizedMessage[] = (r.data?.data ?? [])
      .map((m: any): NormalizedMessage => ({
        externalId: String(m.id),
        direction: String(m?.from?.id ?? '') === account.externalId ? 'out' : 'in',
        body: typeof m.message === 'string' ? m.message : '',
        attachments: (Array.isArray(m?.attachments?.data) ? m.attachments.data : [])
          .map((a: any) => (typeof a?.media?.url === 'string' ? { url: a.media.url } : null))
          .filter(Boolean),
        sentAt: m?.created_time ?? new Date().toISOString(),
      }))
      .reverse();
    return { items, cursor: r.data?.paging?.cursors?.after ?? null };
  },

  async sendMessage(account, conversationId, content): Promise<SendResult> {
    // Instagram send rides the business-account id with recipients.
    const r = await httpJson({
      provider: 'instagram',
      method: 'POST',
      url: `${GRAPH}/${account.externalId}/messages`,
      headers: { Authorization: `Bearer ${account.token}` },
      body: {
        recipient: { conversation_id: conversationId },
        message: { text: content.text },
      },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Instagram send', r.data, r.status);
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
    if (r.status !== 200 && r.status !== 201) throw httpError('Instagram comments', r.data, r.status);
    const mine = String(account.displayId ?? '').replace(/^@/, '');
    const items: NormalizedComment[] = [];
    for (const c of r.data?.data ?? []) {
      items.push({
        externalId: String(c.id),
        parentExternalId: null,
        authorName: c?.username ? `@${c.username}` : 'Instagram user',
        authorAvatar: null,
        body: typeof c.text === 'string' ? c.text : '',
        createdAt: c?.timestamp ?? new Date().toISOString(),
        isOwn: !!mine && String(c?.username ?? '') === mine,
      });
      for (const rep of Array.isArray(c?.replies?.data) ? c.replies.data : []) {
        items.push({
          externalId: String(rep.id),
          parentExternalId: String(c.id),
          authorName: rep?.username ? `@${rep.username}` : 'Instagram user',
          authorAvatar: null,
          body: typeof rep.text === 'string' ? rep.text : '',
          createdAt: rep?.timestamp ?? new Date().toISOString(),
          isOwn: !!mine && String(rep?.username ?? '') === mine,
        });
      }
    }
    return { items, cursor: r.data?.paging?.cursors?.after ?? null };
  },

  async replyToComment(account, commentId, content): Promise<SendResult> {
    const r = await httpJson({
      provider: 'instagram',
      method: 'POST',
      url: `${GRAPH}/${commentId}/replies`,
      headers: { Authorization: `Bearer ${account.token}` },
      body: { message: content.text },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Instagram reply', r.data, r.status);
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
    if (r.status !== 200 && r.status !== 201) throw httpError('Instagram hide', r.data, r.status);
  },
  async remove(account: Account, commentId: string): Promise<void> {
    const r = await httpJson({
      provider: 'instagram',
      method: 'DELETE',
      url: `${GRAPH}/${commentId}`,
      headers: { Authorization: `Bearer ${account.token}` },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Instagram delete', r.data, r.status);
  },
};
