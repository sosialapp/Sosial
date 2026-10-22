/**
 * Facebook adapter — Pages comments + Messenger, via the Page access token
 * stored in Vault (`pages_manage_posts`, `pages_read_engagement`,
 * `pages_read_user_content`, `pages_manage_engagement`, `pages_messaging`,
 * `pages_manage_metadata`). Official endpoints only:
 *   Pages API:     https://developers.facebook.com/docs/pages-api
 *   Messenger:     https://developers.facebook.com/docs/messenger-platform
 *   Send:          POST /{page-id}/messages (Send API, recipient = PSID)
 */
import { httpJson, withParams } from './http';
import { attachmentType, attachmentUrls, isoTime, metaError } from './graph';
import { isoDate, previewText } from './postPreview';
import type {
  Account, Page, NormalizedConversation, NormalizedMessage, NormalizedComment,
  SendResult, Capabilities, InboxAdapter,
} from './types';

const GRAPH = 'https://graph.facebook.com/v21.0';

export const facebook: InboxAdapter = {
  capabilities(): Capabilities {
    return { inbox: true, comments: true, hideComment: true, deleteComment: true };
  },

  async listConversations(account, cursor): Promise<Page<NormalizedConversation>> {
    const url = withParams(`${GRAPH}/${account.externalId}/conversations`, {
      platform: 'messenger',
      fields: 'id,participants{id,name,email},updated_time,message_count,unread_count,snippet',
      limit: 25,
      after: cursor ?? undefined,
    });
    const r = await httpJson({ url, provider: 'facebook', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw metaError('Facebook messages', r.data, r.status);
    const items: NormalizedConversation[] = (r.data?.data ?? []).map((c: any): NormalizedConversation => {
      const me = account.externalId;
      const other = (c?.participants?.data ?? []).find((p: any) => String(p?.id ?? '') !== me);
      return {
        externalId: String(c.id),
        participantExternalId: other?.id ? String(other.id) : null,
        participantName: other?.name ?? other?.email ?? 'Messenger user',
        participantAvatar: null,
        lastMessageAt: isoTime(c?.updated_time ?? new Date().toISOString()),
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
    if (r.status !== 200 && r.status !== 201) throw metaError('Facebook thread', r.data, r.status);
    const items: NormalizedMessage[] = (r.data?.data ?? [])
      .map((m: any): NormalizedMessage => ({
        externalId: String(m.id),
        direction: String(m?.from?.id ?? '') === account.externalId ? 'out' : 'in',
        body: typeof m.message === 'string' ? m.message : '',
        attachments: attachmentUrls(m.attachments),
        sentAt: isoTime(m?.created_time ?? new Date().toISOString()),
      }))
      // oldest → newest for the thread view
      .reverse();
    return { items, cursor: r.data?.paging?.cursors?.after ?? null };
  },

  async sendMessage(account, _conversationId, content, recipientId): Promise<SendResult> {
    // Send API is page-scoped: post to the Page with the person's PSID. The
    // conversation id is not a recipient and has no send edge.
    if (!recipientId) {
      throw new Error(
        'Facebook send: this conversation has no Messenger user id yet — run a sync and try again.',
      );
    }
    const attach = content.attachmentUrls?.[0];
    const body: Record<string, unknown> = {
      recipient: { id: String(recipientId) },
      messaging_type: 'RESPONSE',
      message: {
        text: content.text,
        ...(attach ? { attachment: { type: attachmentType(attach), payload: { url: attach } } } : {}),
      },
    };
    const r = await httpJson({
      provider: 'facebook',
      method: 'POST',
      url: `${GRAPH}/${account.externalId}/messages`,
      headers: { Authorization: `Bearer ${account.token}` },
      body,
    });
    if (r.status !== 200 && r.status !== 201) throw metaError('Facebook send', r.data, r.status);
    return { externalId: String(r.data?.message_id ?? ''), sentAt: new Date().toISOString() };
  },

  async listComments(account, postId, cursor): Promise<Page<NormalizedComment>> {
    // filter=stream returns the full tree (replies included) with parent ids.
    const url = withParams(`${GRAPH}/${postId}/comments`, {
      filter: 'stream',
      fields: 'id,created_time,from{id,name,picture},message,parent{id}',
      limit: 100,
      after: cursor ?? undefined,
    });
    const r = await httpJson({ url, provider: 'facebook', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw metaError('Facebook comments', r.data, r.status);
    const items: NormalizedComment[] = (r.data?.data ?? []).map((c: any): NormalizedComment => ({
      externalId: String(c.id),
      parentExternalId: c?.parent?.id ? String(c.parent.id) : null,
      authorName: c?.from?.name ? c.from.name : 'Page visitor',
      authorAvatar: c?.from?.picture?.data?.url ?? null,
      body: typeof c.message === 'string' ? c.message : '',
      createdAt: isoTime(c?.created_time ?? new Date().toISOString()),
      isOwn: String(c?.from?.id ?? '') === account.externalId,
    }));
    return { items, cursor: r.data?.paging?.cursors?.after ?? null };
  },

  /** Newest Page posts (including ones published outside Sosial), so their
   *  comment threads enter the inbox too. `message`/`permalink_url`/
   *  `full_picture` come from the same read so the inbox can show the post. */
  async listOwnPosts(account, limit) {
    const url = withParams(`${GRAPH}/${account.externalId}/posts`, {
      fields: 'id,comments.summary(true).limit(0),message,permalink_url,created_time,full_picture',
      limit: Math.max(1, Math.min(limit, 50)),
    });
    const r = await httpJson({ url, provider: 'facebook', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw metaError('Facebook posts', r.data, r.status);
    return (r.data?.data ?? []).map((p: any) => ({
      externalId: String(p.id),
      commentCount: Number(p?.comments?.summary?.total_count ?? 0),
      url: p?.permalink_url ?? null,
      text: previewText(p?.message),
      thumbnail: p?.full_picture ?? null,
      postedAt: isoDate(p?.created_time),
      mediaKind: p?.full_picture ? 'image' : 'text',
    }));
  },

  async replyToComment(account, commentId, content): Promise<SendResult> {
    const r = await httpJson({
      provider: 'facebook',
      method: 'POST',
      url: `${GRAPH}/${commentId}/comments`,
      headers: { Authorization: `Bearer ${account.token}` },
      body: { message: content.text },
    });
    if (r.status !== 200 && r.status !== 201) throw metaError('Facebook reply', r.data, r.status);
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
    if (r.status !== 200 && r.status !== 201) throw metaError('Facebook hide', r.data, r.status);
  },
  async unhide(account: Account, commentId: string): Promise<void> {
    const r = await httpJson({
      provider: 'facebook',
      method: 'POST',
      url: `${GRAPH}/${commentId}`,
      headers: { Authorization: `Bearer ${account.token}` },
      body: { is_hidden: false },
    });
    if (r.status !== 200 && r.status !== 201) throw metaError('Facebook unhide', r.data, r.status);
  },
  async remove(account: Account, commentId: string): Promise<void> {
    const r = await httpJson({
      provider: 'facebook',
      method: 'DELETE',
      url: `${GRAPH}/${commentId}`,
      headers: { Authorization: `Bearer ${account.token}` },
    });
    if (r.status !== 200 && r.status !== 201) throw metaError('Facebook delete', r.data, r.status);
  },
};
