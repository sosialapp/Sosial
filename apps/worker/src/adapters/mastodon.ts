/**
 * Mastodon adapter — instance-scoped API; base URL comes from the
 * channel's instance_url (every user's instance differs).
 *   Conversations: https://docs.joinmastodon.org/methods/conversations/
 *   Notifications: https://docs.joinmastodon.org/methods/notifications
 *   Thread context:https://docs.joinmastodon.org/methods/statuses/
 * Scopes: read:notifications read:statuses write:statuses write:conversations
 */
import { httpJson, httpError, withParams } from './http';
import type {
  Account, Page, NormalizedConversation, NormalizedMessage, NormalizedComment,
  SendResult, Capabilities, InboxAdapter,
} from './types';

export function normalizeInstance(instanceUrl: string | null): string {
  const host = String(instanceUrl ?? '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/\/+$/, '').split('/')[0].split('?')[0];
  if (!host || /\s/.test(host)) throw new Error('Mastodon channel has no instance, reconnect the channel.');
  return `https://${host}`;
}

const strip = (s: string): string => s.replace(/<[^>]+>/g, '').trim();

export const mastodon: InboxAdapter = {
  capabilities(): Capabilities {
    return { inbox: true, comments: true, hideComment: false, deleteComment: false };
  },

  async listConversations(account, cursor): Promise<Page<NormalizedConversation>> {
    const base = normalizeInstance(account.instanceUrl);
    const url = withParams(`${base}/api/v1/conversations`, {
      limit: 40,
      max_id: cursor ?? undefined,
    });
    const r = await httpJson({ url, provider: 'mastodon', headers: { Authorization: `Bearer ${account.token}` } });
    if (r.status !== 200 && r.status !== 201) throw httpError('Mastodon conversations', r.data, r.status);
    const anyR = r as unknown as { headers?: Headers };
    const items: NormalizedConversation[] = (Array.isArray(r.data) ? r.data : []).map((c: any): NormalizedConversation => {
      const other = (c?.accounts ?? []).find((a: any) => String(a?.id ?? '') !== account.externalId);
      return {
        externalId: String(c.id),
        participantName: other ? `@${other.acct}` : 'Mastodon user',
        participantAvatar: other?.avatar ?? null,
        lastMessageAt: c?.last_status?.created_at ?? new Date().toISOString(),
        unreadCount: Number(c?.unread ?? 0),
      };
    });
    // Link header pagination: <url>; rel="next"
    const link = anyR.headers?.get('link') ?? '';
    const nextMatch = /<([^>]+)>;\s*rel="next"/.exec(link);
    const nextCursor = nextMatch ? /[?&]max_id=(\d+)/.exec(nextMatch[1])?.[1] ?? null : null;
    return { items, cursor: nextCursor };
  },

  async listMessages(account, conversationId, _cursor): Promise<Page<NormalizedMessage>> {
    const base = normalizeInstance(account.instanceUrl);
    void _cursor;
    // Mastodon conversations are virtual: the authoritative thread is the
    // status context (ancestors + descendants) around the latest message.
    const convs = await httpJson({
      provider: 'mastodon',
      url: withParams(`${base}/api/v1/conversations`, { limit: 40 }),
      headers: { Authorization: `Bearer ${account.token}` },
    });
    if (convs.status !== 200 && convs.status !== 201) throw httpError('Mastodon conversations', convs.data, convs.status);
    const convo = (Array.isArray(convs.data) ? convs.data : []).find((c: any) => String(c?.id ?? '') === conversationId);
    const last = convo?.last_status;
    if (!last?.id) return { items: [], cursor: null };
    const ctx = await httpJson({
      provider: 'mastodon',
      url: `${base}/api/v1/statuses/${encodeURIComponent(String(last.id))}/context`,
      headers: { Authorization: `Bearer ${account.token}` },
    });
    if (ctx.status !== 200 && ctx.status !== 201) throw httpError('Mastodon thread', ctx.data, ctx.status);
    const partners = new Set((convo.accounts ?? []).map((a: any) => String(a.id)));
    partners.delete(account.externalId);
    const statuses: NormalizedMessage[] = [
      ...(Array.isArray(ctx.data?.ancestors) ? ctx.data.ancestors : []),
      last,
      ...(Array.isArray(ctx.data?.descendants) ? ctx.data.descendants : []),
    ]
      .filter((s: any) => {
        const involved =
          partners.has(String(s?.account?.id)) ||
          (Array.isArray(s?.mentions) && s.mentions.some((mm: any) => partners.has(String(mm.id))));
        return involved;
      })
      .map((s: any): NormalizedMessage => ({
        externalId: String(s.id),
        direction: String(s?.account?.id) === account.externalId ? 'out' : 'in',
        body: strip(String(s?.content ?? '')),
        attachments: (Array.isArray(s?.media_attachments) ? s.media_attachments : [])
          .map((mm: any) => (typeof mm?.url === 'string' ? { url: mm.url } : null))
          .filter((x: any): x is { url: string } => !!x),
        sentAt: s?.created_at ?? new Date().toISOString(),
      }))
      .filter((m, i, all) => all.findIndex((x) => x.externalId === m.externalId) === i)
      .sort((a, z) => a.sentAt.localeCompare(z.sentAt));
    return { items: statuses, cursor: null };
  },

  async sendMessage(account, conversationId, content): Promise<SendResult> {
    const base = normalizeInstance(account.instanceUrl);
    // Reply into the conversation = direct status referencing its last one.
    const convs = await httpJson({
      provider: 'mastodon',
      url: withParams(`${base}/api/v1/conversations`, { limit: 40 }),
      headers: { Authorization: `Bearer ${account.token}` },
    });
    if (convs.status !== 200 && convs.status !== 201) throw httpError('Mastodon conversations', convs.data, convs.status);
    const convo = (Array.isArray(convs.data) ? convs.data : []).find((c: any) => String(c?.id ?? '') === conversationId);
    if (!convo) throw new Error('Mastodon conversation not found, refresh the inbox.');
    const lastId = convo?.last_status?.id ?? null;
    // Direct statuses are delivered to the accounts mentioned in the text;
    // in_reply_to_id alone is not a recipient list. Prefix every participant.
    const mentions = (Array.isArray(convo.accounts) ? convo.accounts : [])
      .filter((a: any) => String(a?.id ?? '') !== account.externalId && a?.acct)
      .map((a: any) => `@${String(a.acct)}`)
      .join(' ');
    const r = await httpJson({
      provider: 'mastodon',
      method: 'POST',
      url: `${base}/api/v1/statuses`,
      headers: { Authorization: `Bearer ${account.token}` },
      body: {
        status: mentions ? `${mentions} ${content.text}` : content.text,
        visibility: 'direct',
        ...(lastId ? { in_reply_to_id: lastId } : {}),
      },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Mastodon send', r.data, r.status);
    return { externalId: String(r.data?.id ?? ''), sentAt: new Date().toISOString() };
  },

  /** Own recent statuses, so replies on posts made outside Sosial reach the
   *  Comments inbox (the context read is per-status). */
  async listOwnPosts(account, limit): Promise<{ externalId: string; commentCount: number }[]> {
    const base = normalizeInstance(account.instanceUrl);
    const r = await httpJson({
      provider: 'mastodon',
      url: withParams(`${base}/api/v1/accounts/${encodeURIComponent(account.externalId)}/statuses`, {
        limit: Math.min(40, Math.max(5, limit)),
        exclude_replies: 'true',
        exclude_reblogs: 'true',
      }),
      headers: { Authorization: `Bearer ${account.token}` },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Mastodon posts', r.data, r.status);
    return (Array.isArray(r.data) ? r.data : [])
      .filter((s: any) => s?.id && !s?.reblog)
      .map((s: any) => ({
        externalId: String(s.id),
        commentCount: Math.max(0, Number(s.replies_count ?? 0)),
      }));
  },

  async listComments(account, postId, cursor): Promise<Page<NormalizedComment>> {
    const base = normalizeInstance(account.instanceUrl);
    void cursor; // context is a single expanded read (backward paging not offered)
    const r = await httpJson({
      provider: 'mastodon',
      url: `${base}/api/v1/statuses/${encodeURIComponent(postId)}/context`,
      headers: { Authorization: `Bearer ${account.token}` },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Mastodon comments', r.data, r.status);
    // Our own replies live in descendants too; they are thread noise in the
    // Comments inbox, not comments to answer.
    const items: NormalizedComment[] = (Array.isArray(r.data?.descendants) ? r.data.descendants : [])
      .filter((s: any) => String(s?.account?.id ?? '') !== account.externalId)
      .map((s: any): NormalizedComment => ({
        externalId: String(s.id),
        parentExternalId: s?.in_reply_to_id ? String(s.in_reply_to_id) : null,
        authorName: s?.account?.acct ? `@${s.account.acct}` : 'Mastodon user',
        authorAvatar: s?.account?.avatar ?? null,
        body: strip(String(s?.content ?? '')),
        createdAt: s?.created_at ?? new Date().toISOString(),
      }));
    return { items, cursor: null };
  },

  async replyToComment(account, commentId, content): Promise<SendResult> {
    const base = normalizeInstance(account.instanceUrl);
    const r = await httpJson({
      provider: 'mastodon',
      method: 'POST',
      url: `${base}/api/v1/statuses`,
      headers: { Authorization: `Bearer ${account.token}` },
      body: { status: content.text, in_reply_to_id: commentId, visibility: 'public' },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Mastodon reply', r.data, r.status);
    return { externalId: String(r.data?.id ?? ''), sentAt: new Date().toISOString() };
  },
};
