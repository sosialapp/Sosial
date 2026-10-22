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

const DM_FIELDS = 'id,created_at,event_type,sender_id,conversation_id,message_create';
const USER_FIELDS = 'name,username,profile_image_url';

/** X names 1:1 conversations after the two participant ids, sorted. */
const expectedConvoId = (meId: string, otherId: string): string => {
  const [a, b] = [meId, otherId].sort();
  return `${a}-${b}`;
};

interface XEvent {
  id: string;
  event_type: string;
  created_at?: string;
  conversation_id?: string;
  sender_id?: string;
  message_create?: { sender_id?: string; message_data?: { text?: string; attachments?: { media_ids?: string[] } } };
}

interface XUser { id: string; name?: string; username?: string; profile_image_url?: string }

interface DmPage {
  events: XEvent[];
  cursor: string | null;
  mediaUrls: Map<string, string>;
  users: Map<string, XUser>;
}

function readPage(data: any): DmPage {
  const media = new Map<string, string>();
  for (const m of Array.isArray(data?.includes?.media) ? data.includes.media : []) {
    if (m?.media_key && typeof m.url === 'string') media.set(String(m.media_key), m.url);
  }
  const users = new Map<string, XUser>();
  for (const u of Array.isArray(data?.includes?.users) ? data.includes.users : []) {
    if (u?.id) users.set(String(u.id), u);
  }
  return {
    events: Array.isArray(data?.data) ? data.data : [],
    cursor: data?.meta?.next_token ?? null,
    mediaUrls: media,
    users,
  };
}

/** One paged read of the account's DM events (newest first), used to collage
 *  the conversation list (X has no list endpoint for low tiers). */
async function dmEventsPage(account: Account, cursor: string | null): Promise<DmPage> {
  const url = withParams(`${X}/dm_events`, {
    event_types: 'MessageCreate',
    'dm_event.fields': DM_FIELDS,
    expansions: 'sender_id,attachments.media_ids',
    'user.fields': USER_FIELDS,
    'media.fields': 'url',
    max_results: 100,
    ...(cursor ? { pagination_token: cursor } : {}),
  });
  const r = await httpJson({ url, provider: 'x', headers: auth(account.token) });
  if (r.status === 403) {
    throw httpError('X messages', {
      error: {
        message: 'X refused the DM read (403) — the account needs the paid tier that includes messaging, or dm.read is missing. Reconnect the X channel, then check the X dashboard.',
      },
    }, r.status);
  }
  if (r.status !== 200 && r.status !== 201) throw httpError('X messages', r.data, r.status);
  return readPage(r.data);
}

/** Messages inside one conversation: proper per-thread pagination instead of
 *  filtering the global event feed (which silently lost older messages). */
async function dmConvoPage(account: Account, convoId: string, cursor: string | null): Promise<DmPage> {
  const url = withParams(`${X}/dm_conversations/${encodeURIComponent(convoId)}/dm_events`, {
    'dm_event.fields': DM_FIELDS,
    expansions: 'sender_id,attachments.media_ids',
    'user.fields': USER_FIELDS,
    'media.fields': 'url',
    max_results: 100,
    ...(cursor ? { pagination_token: cursor } : {}),
  });
  const r = await httpJson({ url, provider: 'x', headers: auth(account.token) });
  if (r.status !== 200 && r.status !== 201) throw httpError('X messages', r.data, r.status);
  return readPage(r.data);
}

const eventIdOf = (e: XEvent): string => String(e?.id ?? '');

export const x: InboxAdapter = {
  capabilities(): Capabilities {
    return { inbox: true, comments: true, hideComment: false, deleteComment: false };
  },

  async listConversations(account, cursor): Promise<Page<NormalizedConversation>> {
    const page = await dmEventsPage(account, cursor);
    const seen = new Map<string, NormalizedConversation>();
    for (const e of page.events) {
      const convoId = String(e?.conversation_id ?? '');
      if (!convoId) continue;
      if (seen.has(convoId)) continue;
      const sender = String(e?.sender_id ?? e?.message_create?.sender_id ?? '');
      const otherId =
        convoId.split('-').find((part) => part && part !== account.externalId) ?? sender;
      const u = page.users.get(otherId);
      seen.set(convoId, {
        externalId: otherId,
        participantName: u?.username ? `@${u.username}` : u?.name ?? `X user ${otherId}`,
        participantAvatar: u?.profile_image_url ?? null,
        lastMessageAt: e?.created_at ?? new Date().toISOString(),
        // X exposes no read state per conversation; treating incoming events
        // as unread would light the badge forever, so it stays quiet.
        unreadCount: 0,
      });
    }
    return { items: [...seen.values()], cursor: page.cursor };
  },

  async listMessages(account, conversationExternal, cursor): Promise<Page<NormalizedMessage>> {
    const convoId = expectedConvoId(account.externalId, conversationExternal);
    const page = await dmConvoPage(account, convoId, cursor);
    const items: NormalizedMessage[] = page.events.map((e) => {
      const sender = String(e?.sender_id ?? e?.message_create?.sender_id ?? '');
      const data = e?.message_create?.message_data ?? {};
      const urls = (Array.isArray(data?.attachments?.media_ids) ? data.attachments.media_ids : [])
        .map((id: string) => page.mediaUrls.get(String(id)))
        .filter((u: string | undefined): u is string => !!u)
        .map((u: string) => ({ url: u }));
      return {
        externalId: eventIdOf(e),
        direction: sender === account.externalId ? 'out' : 'in',
        body: typeof data.text === 'string' ? data.text : '',
        attachments: urls,
        sentAt: e?.created_at ?? new Date().toISOString(),
      };
    });
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

  /** Your own recent tweets, so replies on posts made outside Sosial still
   *  reach the Comments inbox (X's recent-search is per-conversation). */
  async listOwnPosts(account, limit): Promise<{ externalId: string; commentCount: number }[]> {
    const r = await httpJson({
      provider: 'x',
      url: withParams(`${X}/users/${encodeURIComponent(account.externalId)}/tweets`, {
        max_results: Math.min(100, Math.max(5, limit)),
        exclude: 'retweets,replies',
        'tweet.fields': 'public_metrics',
      }),
      headers: auth(account.token),
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('X posts', r.data, r.status);
    return (Array.isArray(r.data?.data) ? r.data.data : []).map((t: any) => ({
      externalId: String(t.id),
      commentCount: Math.max(0, Number(t?.public_metrics?.reply_count ?? 0)),
    }));
  },

  async listComments(account, postId, cursor): Promise<Page<NormalizedComment>> {
    const qs = new URLSearchParams({
      query: `conversation_id:${postId} -is:retweet`,
      max_results: '25',
      'tweet.fields': 'created_at,public_metrics,in_reply_to_user_id',
      expansions: 'author_id',
      'user.fields': USER_FIELDS,
      ...(cursor ? { pagination_token: cursor } : {}),
    });
    const r = await httpJson({ url: `${X}/tweets/search/recent?${qs.toString()}`, provider: 'x', headers: auth(account.token) });
    if (r.status !== 200 && r.status !== 201) throw httpError('X comments', r.data, r.status);
    const users = new Map<string, any>((r.data?.includes?.users ?? []).map((u: any) => [String(u.id), u]));
    const items: NormalizedComment[] = (r.data?.data ?? [])
      // The root tweet comes back with its own thread; our own replies are
      // thread noise in the Comments inbox, not comments to answer.
      .filter((c: any) => String(c.id) !== postId && String(c.author_id) !== account.externalId)
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
    if (r.status === 403) throw httpError('X reply', { error: { message: 'X refused the reply (403) — tweet.write is missing, or the app has no write access on this tier. Reconnect the X channel.' } }, r.status);
    if (r.status !== 200 && r.status !== 201) throw httpError('X reply', r.data, r.status);
    return { externalId: String(r.data?.data?.id ?? ''), sentAt: new Date().toISOString() };
  },
};
