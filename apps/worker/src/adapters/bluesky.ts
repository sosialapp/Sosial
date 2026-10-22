/**
 * Bluesky adapter — app-password credentials (no OAuth in the public API);
 * a session is minted per sweep from the stored app password.
 *   Notifications: app.bsky.feed.getNotifications
 *   Post thread:   app.bsky.feed.getPostThread
 *   DMs (chat):    chat.bsky.convo.listConvos / getMessages / sendMessage
 * Docs: https://docs.bsky.app/
 *
 * The account object carries the channel metadata: bluesky handle +
 * app password (stored as one of the Vault-backed ZaP creds on connect).
 */
import { httpJson, httpError, withParams } from './http';
import { isoDate, previewText } from './postPreview';
import type {
  Account, Page, NormalizedConversation, NormalizedMessage, NormalizedComment,
  SendResult, Capabilities, InboxAdapter, OwnPost,
} from './types';

const XRPC = 'https://bsky.social/xrpc';
/** Bluesky chat is its own service (did:web:api.bsky.chat) - the PDS does not proxy it. */
const CHAT = 'https://api.bsky.chat/xrpc';

interface BskyCreds { handle: string; appPassword: string; did?: string }

function credsOf(account: Account): BskyCreds {
  const meta = account.metadata ?? {};
  const handle = String((meta as any).bluesky_handle ?? account.externalId ?? '').trim();
  const appPassword = String(account.token ?? '').trim();
  if (!handle || !appPassword) throw new Error('Bluesky credentials missing, reconnect the channel.');
  return { handle, appPassword, did: account.externalId && account.externalId.includes(':') ? account.externalId : undefined };
}

interface Session { jwt: string; did: string; at: number; for: BskyCreds }
const sessionCache = new Map<string, Session>();

/**
 * A Bluesky post hides its picture in `embed`, which is either the raw record
 * embed or a hydrated `#view` depending on the feed. Walk both.
 */
function embedPreview(embed: any): { thumbnail: string | null; kind: string } {
  if (!embed) return { thumbnail: null, kind: 'text' };
  const type = String(embed.$type ?? '');
  if (type.includes('recordWithMedia')) return embedPreview(embed.media);
  if (type.includes('images')) {
    const first = Array.isArray(embed.images) ? embed.images[0] : null;
    return { thumbnail: first?.thumb ?? first?.fullsize ?? null, kind: 'image' };
  }
  if (type.includes('video')) {
    return { thumbnail: embed.thumbnail ?? embed.poster ?? null, kind: 'video' };
  }
  if (type.includes('external')) {
    return { thumbnail: embed.external?.thumb ?? null, kind: 'text' };
  }
  return { thumbnail: null, kind: 'text' };
}

/** Session access tokens are JWTs ('ey….'); app passwords never look like one. */
function jwtLike(tok: string): boolean {
  return /^ey[A-Za-z0-9_-]+\./.test(tok);
}

async function session(account: Account, c: BskyCreds): Promise<Session> {
  // Legacy channels store a session JWT in Vault (pre-unified connect):
  // use it as-is so they keep working until the owner reconnects.
  if (jwtLike(c.appPassword)) {
    const cached = sessionCache.get(account.id);
    if (cached && cached.for === c) return cached;
    const s: Session = { jwt: c.appPassword, did: c.did ?? account.externalId, at: Date.now(), for: c };
    sessionCache.set(account.id, s);
    return s;
  }
  const hit = sessionCache.get(account.id);
  if (hit && hit.for.handle === c.handle && hit.for.appPassword === c.appPassword && Date.now() - hit.at < 40 * 60_000) {
    return hit;
  }
  const r = await httpJson({
    provider: 'bluesky',
    method: 'POST',
    url: `${XRPC}/com.atproto.server.createSession`,
    body: { identifier: c.handle, password: c.appPassword },
  });
  if (r.status !== 200 && r.status !== 201) {
    throw httpError('Bluesky sign-in', {
      error: { message: 'Bluesky refused the app password (invalid or revoked). Reconnect the channel in Connect.' },
    }, r.status);
  }
  const s: Session = { jwt: String(r.data?.accessJwt), did: String(r.data?.did), at: Date.now(), for: c };
  sessionCache.set(account.id, s);
  return s;
}

export const bluesky: InboxAdapter = {
  capabilities(): Capabilities {
    // Hiding others' comments and deleting them isn't offered for the
    // logged-in app-pw surface; reply + thread reads are.
    return { inbox: true, comments: true, hideComment: false, deleteComment: false };
  },

  async listConversations(account, cursor): Promise<Page<NormalizedConversation>> {
    const c = credsOf(account);
    const r = await httpJson({
      provider: 'bluesky',
      url: withParams(`${CHAT}/chat.bsky.convo.listConvos`, { limit: 50, cursor: cursor ?? undefined }),
      headers: { Authorization: `Bearer ${(await session(account, c)).jwt}` },
    });
    if (r.status === 400 && /RequiresAuth|chat/.test(String(r.data?.message ?? ''))) {
      throw httpError('Bluesky DMs', {
        error: { message: 'Bluesky chat is not enabled for this account (or the app password lacks chat access).' },
      }, r.status);
    }
    if (r.status !== 200 && r.status !== 201) throw httpError('Bluesky DMs', r.data, r.status);
    const meDid = (await session(account, c)).did;
    // chat.bsky.convo.listConvos returns { convos: [...] }.
    const items: NormalizedConversation[] = (r.data?.convos ?? []).map((cv: any): NormalizedConversation => {
      const members = Array.isArray(cv?.members) ? cv.members : [];
      const other = members.find((m: any) => String(m?.did ?? '') !== meDid) ?? members[0];
      return {
        externalId: String(cv.id),
        participantName: other ? (other.displayName || `@${other.handle}`) : 'Bluesky user',
        participantAvatar: other?.avatar ?? null,
        lastMessageAt: cv?.lastMessage?.sentAt ?? new Date().toISOString(),
        unreadCount: Math.max(0, Number(cv?.unreadCount ?? 0)),
      };
    });
    return { items, cursor: r.data?.cursor ?? null };
  },

  async listMessages(account, conversationId, cursor): Promise<Page<NormalizedMessage>> {
    const c = credsOf(account);
    const s = await session(account, c);
    const r = await httpJson({
      provider: 'bluesky',
      url: withParams(`${CHAT}/chat.bsky.convo.getMessages`, {
        convoId: conversationId,
        limit: 50,
        cursor: cursor ?? undefined,
      }),
      headers: { Authorization: `Bearer ${s.jwt}` },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Bluesky thread', r.data, r.status);
    const items: NormalizedMessage[] = (r.data?.messages ?? [])
      .filter((m: any) => m?.id && m?.rev) // revokes are hidden posts; skip ghosts
      .map((m: any): NormalizedMessage => ({
        externalId: String(m.id),
        direction: String(m?.sender?.did ?? '') === s.did ? 'out' : 'in',
        body: typeof m.text === 'string' ? m.text : '',
        attachments: (Array.isArray(m.embeds) ? m.embeds : [])
          .map((e: any) => (typeof e?.external?.uri === 'string' ? { url: e.external.uri } : null))
          .filter(Boolean),
        sentAt: m?.sentAt ?? new Date().toISOString(),
      }));
    // Returned newest-first per chat spec; flip for a chat view.
    items.reverse();
    return { items, cursor: r.data?.cursor ?? null };
  },

  async sendMessage(account, conversationId, content): Promise<SendResult> {
    const c = credsOf(account);
    const s = await session(account, c);
    const r = await httpJson({
      provider: 'bluesky',
      method: 'POST',
      url: `${CHAT}/chat.bsky.convo.sendMessage`,
      headers: { Authorization: `Bearer ${s.jwt}` },
      body: {
        convoId: conversationId,
        message: {
          text: content.text,
          createdAt: new Date().toISOString(),
          facets: [],
          ...(content.attachmentUrls?.length ? { embeds: [{ external: { uri: content.attachmentUrls[0] } }] } : {}),
        },
      },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Bluesky send', r.data, r.status);
    return { externalId: String(r.data?.id ?? ''), sentAt: new Date().toISOString() };
  },

  async listOwnPosts(account, limit): Promise<OwnPost[]> {
    // Comments are threads on any of the account's posts, not only the ones
    // Sosial happened to publish (older factory posts, manual posts). The
    // author feed is the only official way to enumerate them, and it already
    // carries the record text + embeds for the inbox post strip.
    const c = credsOf(account);
    const s = await session(account, c);
    const r = await httpJson({
      provider: 'bluesky',
      url: withParams(`${XRPC}/app.bsky.feed.getAuthorFeed`, { actor: s.did, limit }),
      headers: { Authorization: `Bearer ${s.jwt}` },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Bluesky posts', r.data, r.status);
    return (r.data?.feed ?? [])
      .filter((it: any) => it?.post?.uri && !it?.reason)
      .map((it: any) => {
        const p = it.post;
        const embed = p?.embed ?? p?.record?.embed ?? null;
        const preview = embedPreview(embed);
        const author = String(p?.author?.handle ?? c.handle).replace(/^@/, '');
        const rkey = String(p.uri).split('/').pop() ?? '';
        return {
          externalId: String(p.uri),
          commentCount: Math.max(0, Number(p.replyCount ?? 0)),
          url: author && rkey ? `https://bsky.app/profile/${author}/post/${rkey}` : null,
          text: previewText(p?.record?.text),
          thumbnail: preview.thumbnail,
          postedAt: isoDate(p?.record?.createdAt ?? p?.indexedAt),
          mediaKind: preview.kind,
        };
      });
  },

  async listComments(account, postId, cursor): Promise<Page<NormalizedComment>> {
    // postId is the at-uri of a Sosial-published status. getPostThread
    // returns the full reply tree — the flat normalized list rides out.
    const c = credsOf(account);
    const r = await httpJson({
      provider: 'bluesky',
      url: withParams(`${XRPC}/app.bsky.feed.getPostThread`, {
        uri: postId,
        depth: 3,
        parentHeight: 0,
      }),
      headers: { Authorization: `Bearer ${(await session(account, c)).jwt}` },
    });
    if (r.status === 400 && /not-found|NotFound/.test(String(r.data?.message ?? ''))) {
      // Post deleted at the platform level — nothing to read.
      return { items: [], cursor: null };
    }
    if (r.status !== 200 && r.status !== 201) throw httpError('Bluesky comments', r.data, r.status);
    const items: NormalizedComment[] = [];
    const walk = (nodes: any, parentUri: string | null): void => {
      for (const n of Array.isArray(nodes) ? nodes : []) {
        const post = n?.post;
        if (post?.uri) {
          items.push({
            externalId: String(post.uri),
            parentExternalId: parentUri,
            authorName: post?.author?.handle ? `@${post.author.handle}` : 'Bluesky user',
            authorAvatar: post?.author?.avatar ?? null,
            body: typeof post?.record?.text === 'string' ? post.record.text : '',
            createdAt: post?.record?.createdAt ?? post?.indexedAt ?? new Date().toISOString(),
            isOwn: String(post?.author?.did ?? '') === account.externalId,
          });
          walk(n?.replies, String(post.uri));
        }
      }
    };
    walk(r.data?.thread?.replies, postId);
    // getPostThread is a single deep read; cursor is unused.
    return { items, cursor: null };
  },

  async replyToComment(account, commentUri, content): Promise<SendResult> {
    const c = credsOf(account);
    const s = await session(account, c);
    // Parent post details for the reply record: uri + cid + root.
    const pr = await httpJson({
      provider: 'bluesky',
      url: withParams(`${XRPC}/app.bsky.feed.getPosts`, {
        uris: commentUri,
      }),
      headers: { Authorization: `Bearer ${s.jwt}` },
    });
    if (pr.status !== 200 && pr.status !== 201) throw httpError('Bluesky parent post', pr.data, pr.status);
    const post = pr.data?.posts?.[0];
    if (!post) throw new Error('Bluesky comment not found (deleted?).');
    const replyRoot = post?.record?.reply?.root ?? { uri: post.uri, cid: post.cid };
    const r = await httpJson({
      provider: 'bluesky',
      method: 'POST',
      url: `${XRPC}/com.atproto.repo.createRecord`,
      headers: { Authorization: `Bearer ${s.jwt}` },
      body: {
        repo: s.did,
        collection: 'app.bsky.feed.post',
        record: {
          text: content.text,
          createdAt: new Date().toISOString(),
          reply: {
            root: { uri: replyRoot.uri, cid: replyRoot.cid },
            parent: { uri: post.uri, cid: post.cid },
          },
        },
      },
    });
    if (r.status !== 200 && r.status !== 201) throw httpError('Bluesky reply', r.data, r.status);
    return { externalId: String(r.data?.uri ?? ''), sentAt: new Date().toISOString() };
  },
};
