/**
 * X adapter — DMs (user-context OAuth2 token) + replies via recent search.
 * DMs: https://docs.x.com/x-api/direct-messages/manage/introduction
 * Integration: https://docs.x.com/x-api/direct-messages/manage/integrate
 * Scopes: dm.read dm.write tweet.read users.read offline.access
 * Limits: 1,000 DMs/24h (individual), paid tier required for the user's
 * plan (autobilled) — surfaced at runtime as plain Facebook-style errors.
 */
import { httpJson, httpError, withParams } from './http';
import type {
  Account, Page, NormalizedConversation, NormalizedMessage, NormalizedComment,
  SendResult, Capabilities, InboxAdapter,
} from './types';

const X = 'https://api.x.com/2';
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const DM_FIELDS = 'message_create,sender_id,conversation_id';
const USER_FIELDS = 'name,username,profile_image_url';

const expectedConvoId = (meId: string, otherId: string): string => {
  const [a, b] = [meId, otherId].sort();
  return `tw-convo-${a}-${b}`;
};

interface XEvent {
  id: string;
  event_type: string;
  created_at?: string;
  conversation_id?: string;
  message_create?: { sender_id?: string; message_data?: { text?: string; attachments?: { media_ids?: string[] } } };
}

/** One paged read of DM events (newest first), reused by both convo list
 *  and per-conversation message rebuild. */
async function dmEventsPage(
  account: Account,
  cursor: string | null,
): Promise<{ events: XEvent[]; cursor: string | null; mediaUrls: Map<string, string> }> {
  const url = withParams(`${X}/dm_events`, {
    user_id: account.externalId,
    event_types: 'MessageCreate',
    'dm_event.fields': 'id,created_at,event_type,message_create,conversation_id',
    'expansions': 'attachments.media_ids',
    'media.fields': 'url',
    max_results: 100,
    ...(cursor ? { pagination_token: cursor } : {}),
  });
  const r = await httpJson({ url, provider: 'x', headers: auth(account.token) });
  if (r.status === 403) {
    throw httpError('X messages', {
      error: {
        message: 'X refused the DM read (403) — the account needs the paid tier that includes messaging, or dm.read is missing. Check the X dashboard.',
      },
    }, r.status);
  }
  if (r.status !== 200 && r.status !== 201) throw httpError('X messages', r.data, r.status);
  const media = new Map<string, string>();
  for (const m of Array.isArray(r.data?.includes?.media) ? r.data.includes.media : []) {
    if (m?.media_key && typeof m.url === 'string') media.set(String(m.media_key), m.url);
  }
  return {
    events: Array.isArray(r.data?.data) ? r.data.data : [],
    cursor: r.data?.meta?.next_token ?? null,
    mediaUrls: media,
  };
}

const eventIdOf = (e: XEvent): string => String(e?.id ?? '');

export const x: InboxAdapter = {
  capabilities(): Capabilities {
    return { inbox: true, comments: true, hideComment: false, deleteComment: false };
  },

  async listConversations(account, cursor): Promise<Page<NormalizedConversation>> {
    // DM events are a global feed; collage by conversation_id in-code.
    const page = await dmEventsPage(account, cursor);
    const seen = new Map<string, NormalizedConversation>();
    for (const e of page.events) {
      const convoId = String(e?.conversation_id ?? '');
      if (!convoId) continue;
      if (seen.has(convoId)) continue;
      const sender = String(e?.message_create?.sender_id ?? '');
      const otherId = convoId
        .replace('tw-convo-', '')
        .split('-')
        .find((id) => id !== account.externalId) ?? sender;
      const incoming = sender !== account.externalId;
      seen.set(convoId, {
        externalId: otherId,
        participantName: `X user ${otherId}`,
        participantAvatar: null,
        lastMessageAt: e?.created_at ?? new Date().toISOString(),
        unreadCount: incoming ? 1 : 0,
      });
    }
    return { items: [...seen.values()], cursor: page.cursor };
  },

  async listMessages(account, conversationExternal, cursor): Promise<Page<NormalizedMessage>> {
    const expected = expectedConvoId(account.externalId, conversationExternal);
    const page = await dmEventsPage(account, cursor);
    const items: NormalizedMessage[] = [];
    for (const e of page.events) {
      if (String(e?.conversation_id ?? '') !== expected) continue;
      const sender = String(e?.message_create?.sender_id ?? '');
      const data = e?.message_create?.message_data ?? {};
      const urls = (Array.isArray(data?.attachments?.media_ids) ? data.attachments.media_ids : [])
        .map((id: string) => page.mediaUrls.get(String(id)))
        .filter((u: string | undefined): u is string => !!u)
        .map((u: string) => ({ url: u }));
      items.push({
        externalId: eventIdOf(e),
        direction: sender === account.externalId ? 'out' : 'in',
        body: typeof data.text === 'string' ? data.text : '',
        attachments: urls,
        sentAt: e?.created_at ?? new Date().toISOString(),
      });
    }
    items.sort((a, z) => a.sentAt.localeCompare(z.sentAt));
    return { items, cursor: page.cursor };
  },

  async sendMessage(account, conversationExternal, content): Promise<SendResult> {
    const r = await httpJson({
      provider: 'x',
      method: 'POST',
      url: `${X}/dm_conversations/with/${encodeURIComponent(conversationExternal)}/messages`,
      headers: auth(account.token),
      body: content.attachmentUrls?.length
        ? { text: content.text, attachment: { media_id: content.attachmentUrls[0] } }
        : { text: content.text },
    });
    if (r.status === 403) throw httpError('X send', { error: { message: 'X refused the send (403) — dm.write or the paid tier is missing.' } }, r.status);
    if (r.status !== 200 && r.status !== 201) throw httpError('X send', r.data, r.status);
    return {
      externalId: String(r.data?.data?.dm_conversation_id ?? r.data?.data?.id ?? ''),
      sentAt: new Date().toISOString(),
    };
  },

  async listComments(_account, postId, cursor): Promise<Page<NormalizedComment>> {
    const qs = new URLSearchParams({
      query: `conversation_id:${postId} -is:retweet`,
      max_results: '25',
      'tweet.fields': 'created_at,public_metrics,in_reply_to_user_id',
      expansions: 'author_id',
      'user.fields': USER_FIELDS,
      ...(cursor ? { pagination_token: cursor } : {}),
    });
    const r = await httpJson({ url: `${X}/tweets/search/recent?${qs.toString()}`, provider: 'x', headers: auth(_account.token) });
    if (r.status !== 200 && r.status !== 201) throw httpError('X comments', r.data, r.status);
    const users = new Map<string, any>((r.data?.includes?.users ?? []).map((u: any) => [String(u.id), u]));
    const items: NormalizedComment[] = (r.data?.data ?? [])
      .filter((c: any) => String(c.id) !== postId)
      .map((c: any): NormalizedComment => {
        const u = users.get(String(c.author_id));
        return {
          externalId: String(c.id),
          parentExternalId: null,
          authorName: u?.username ? `@${u.username}` : 'X user',
          authorAvatar: u?.profile_image_url ?? null,
          body: typeof c.text === 'string' ? c.text : '',
          createdAt: c?.created_at ?? new Date().toISOString(),
        };
      });
    return { items, cursor: r.data?.meta?.next_token ?? null };
  },

  async replyToComment(account, commentId, content): Promise<SendResult> {
    const r = await httpJson({
      provider: 'x',
      method: 'POST',
      url: `${X}/tweets`,
      headers: auth(account.token),
      body: {
        text: content.text,
        ...(commentId ? { reply: { in_reply_to_tweet_id: commentId } } : {}),
      },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('X reply', r.data, r.status);
    return { externalId: String(r.data?.data?.id ?? ''), sentAt: new Date().toISOString() };
  },
};
