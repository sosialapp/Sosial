/**
 * Facebook adapter — Pages comments + Messenger, via the Page access token
 * stored in Vault (`pages_manage_posts`, `pages_read_engagement`,
 * `pages_messaging`, `pages_read_user_content`). Official endpoints only:
 *   Pages API:     https://developers.facebook.com/docs/pages-api
 *   Messenger:     https://developers.facebook.com/docs/messenger-platform
 *   Send:          POST /{conversation_id}/messages (conversation form)
 */
import { httpJson, httpError, withParams } from './http';
import type {
  Account, Page, NormalizedConversation, NormalizedMessage, NormalizedComment,
  SendResult, Capabilities, InboxAdapter,
} from './types';

const GRAPH = 'https://graph.facebook.com/v21.0';

interface Att { media?: { image?: { uri: string } } | null; image_data?: { url?: string } }
const attUrls = (atts: any): { url: string }[] => {
  const data = Array.isArray(atts?.data) ? atts.data : [];
  const out: { url: string }[] = [];
  for (const a of data) {
    const url = a?.media?.image?.uri ?? a?.image_data?.url ?? null;
    if (typeof url === 'string') out.push({ url });
  }
  return out;
};

export const facebook: InboxAdapter = {
  capabilities(): Capabilities {
    return { inbox: true, comments: true, hideComment: true, deleteComment: true };
  },

  async listConversations(account, cursor): Promise<Page<NormalizedConversation>> {
    const url = withParams(`${GRAPH}/${account.externalId}/conversations`, {
      platform: 'messenger',
      fields: 'id,participants,updated_time,message_count,unread_count,snippet',
      limit: 25,
      after: cursor ?? undefined,
    });
    const r = await httpJson({ url, provider: 'facebook', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw httpError('Facebook messages', r.data, r.status);
    const items: NormalizedConversation[] = (r.data?.data ?? []).map((c: any) => {
      const me = account.externalId;
      const other = (c?.participants?.data ?? []).find((p: any) => String(p?.id ?? '') !== me);
      return {
        externalId: String(c.id),
        participantName: other?.name ?? other?.email ?? 'Messenger user',
        participantAvatar: null,
        lastMessageAt: c?.updated_time ?? new Date().toISOString(),
        unreadCount: Number(c?.unread_count ?? 0),
      };
    });
    return { items, cursor: r.data?.paging?.cursors?.after ?? null };
  },

  async listMessages(account, conversationId, cursor): Promise<Page<NormalizedMessage>> {
    const url = withParams(`${GRAPH}/${conversationId}/messages`, {
      fields: 'id,created_time,from{id,name},message,attachments',
      limit: 50,
      after: cursor ?? undefined,
    });
    const r = await httpJson({ url, provider: 'facebook', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw httpError('Facebook thread', r.data, r.status);
    const items: NormalizedMessage[] = (r.data?.data ?? [])
      .map((m: any): NormalizedMessage => ({
        externalId: String(m.id),
        direction: String(m?.from?.id ?? '') === account.externalId ? 'out' : 'in',
        body: typeof m.message === 'string' ? m.message : '',
        attachments: attUrls(m.attachments),
        sentAt: m?.created_time ?? new Date().toISOString(),
      }))
      // oldest → newest for the thread view
      .reverse();
    return { items, cursor: r.data?.paging?.cursors?.after ?? null };
  },

  async sendMessage(_account, conversationId, content): Promise<SendResult> {
    const r = await httpJson({
      provider: 'facebook',
      method: 'POST',
      url: `${GRAPH}/${conversationId}/messages`,
      headers: { Authorization: `Bearer ${_account.token}` },
      body: { message: content.text, ...(content.attachmentUrls?.length ? { attachment: { type: 'image', payload: { url: content.attachmentUrls[0] } } } : {}) },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Facebook send', r.data, r.status);
    return { externalId: String(r.data?.message_id ?? r.data?.recipient_id ?? ''), sentAt: new Date().toISOString() };
  },

  async listComments(account, postId, cursor): Promise<Page<NormalizedComment>> {
    // filter=stream returns the full tree (replies included) with parent ids.
    const url = withParams(`${GRAPH}/${postId}/comments`, {
      filter: 'stream',
      fields: 'id,created_time,from{id,name},message,parent{id}',
      limit: 100,
      after: cursor ?? undefined,
    });
    const r = await httpJson({ url, provider: 'facebook', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw httpError('Facebook comments', r.data, r.status);
    const items: NormalizedComment[] = (r.data?.data ?? []).map((c: any): NormalizedComment => ({
      externalId: String(c.id),
      parentExternalId: c?.parent?.id ? String(c.parent.id) : null,
      authorName: c?.from?.name ? c.from.name : 'Page visitor',
      authorAvatar: null,
      body: typeof c.message === 'string' ? c.message : '',
      createdAt: c?.created_time ?? new Date().toISOString(),
    }));
    return { items, cursor: r.data?.paging?.cursors?.after ?? null };
  },

  async replyToComment(account, commentId, content): Promise<SendResult> {
    const r = await httpJson({
      provider: 'facebook',
      method: 'POST',
      url: `${GRAPH}/${commentId}/comments`,
      headers: { Authorization: `Bearer ${account.token}` },
      body: { message: content.text },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Facebook reply', r.data, r.status);
    return { externalId: String(r.data?.id ?? ''), sentAt: new Date().toISOString() };
  },
};

export const facebookCommentExtras = {
  async hide(account: Account, commentId: string): Promise<void> {
    const r = await httpJson({
      provider: 'facebook',
      method: 'POST',
      url: `${GRAPH}/${commentId}`,
      headers: { Authorization: `Bearer ${account.token}` },
      body: { is_hidden: true },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Facebook hide', r.data, r.status);
  },
  async unhide(account: Account, commentId: string): Promise<void> {
    const r = await httpJson({
      provider: 'facebook',
      method: 'POST',
      url: `${GRAPH}/${commentId}`,
      headers: { Authorization: `Bearer ${account.token}` },
      body: { is_hidden: false },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Facebook unhide', r.data, r.status);
  },
  async remove(account: Account, commentId: string): Promise<void> {
    const r = await httpJson({
      provider: 'facebook',
      method: 'DELETE',
      url: `https://graph.facebook.com/v21.0/${commentId}`,
      headers: { Authorization: `Bearer ${account.token}` },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Facebook delete', r.data, r.status);
  },
};
