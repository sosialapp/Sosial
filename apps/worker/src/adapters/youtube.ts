/**
 * YouTube adapter — comments/replies only. The YouTube Data API exposes no
 * direct messaging, so the DM tab stays off and only comments sync.
 * Official endpoints:
 *   Threads:  GET  /commentThreads (videoId, part=snippet,replies)
 *   Replies:  GET  /comments       (parentId)
 *   Reply:    POST /comments       (snippet.parentId + snippet.textOriginal)
 *   Uploads:  GET  /channels (contentDetails) → /playlistItems → /videos
 *   Docs:     https://developers.google.com/youtube/v3/docs
 *
 * Quota is the real ceiling: reads cost 1 unit of the project's 10,000/day,
 * but comments.insert costs 50. Reads are therefore one page per thread plus
 * a bounded expansion of the threads that carry more replies than the page
 * embeds.
 */
import { httpJson, withParams } from './http';
import { isoTime } from './graph';
import { isoDate, previewText } from './postPreview';
import type {
  Account, Page, NormalizedConversation, NormalizedMessage, NormalizedComment,
  SendResult, Capabilities, InboxAdapter,
} from './types';

const YT = 'https://www.googleapis.com/youtube/v3';
const MAX_REPLY = 10000;
const COMMENTS_PAGE = 100;
/** How many threads per page may be walked for replies the page didn't embed. */
const MAX_REPLY_EXPANSIONS = 10;

function ytError(label: string, data: any, status: number): Error {
  const e = data?.error ?? {};
  const message = String(e.message ?? data?.message ?? `request failed (${status})`);
  if (status === 401) {
    return new Error(
      `${label}: YouTube session expired, toggle cloud publishing off and on in Connect to refresh.`,
    );
  }
  if (status === 403) {
    if (/quota/i.test(message)) {
      return new Error(`${label}: YouTube API quota exhausted for today, it resets at midnight Pacific.`);
    }
    if (/accessNotConfigured|disabled/i.test(message)) {
      return new Error(`${label}: YouTube Data API v3 isn’t enabled on your Google Cloud project.`);
    }
    if (/commentsDisabled/i.test(message)) {
      return new Error(`${label}: comments are turned off for that video.`);
    }
    return new Error(`${label}: ${message}, the channel may not have permission to manage this video.`);
  }
  return new Error(`${label}: ${message}`);
}

function noMessaging(): never {
  throw new Error('YouTube has no messaging API — comments only.');
}

/** Top-level comments are threads; replies carry their parent in `parentId`. */
function toComment(raw: any, account: Account): NormalizedComment {
  const sn = raw?.snippet ?? {};
  const authorChannel = String(sn?.authorChannelId?.value ?? '');
  return {
    externalId: String(raw?.id ?? ''),
    parentExternalId: sn?.parentId ? String(sn.parentId) : null,
    authorName: String(sn?.authorDisplayName ?? 'YouTube user'),
    authorAvatar: sn?.authorProfileImageUrl ?? null,
    body:
      typeof sn?.textOriginal === 'string'
        ? sn.textOriginal
        : typeof sn?.textDisplay === 'string'
          ? sn.textDisplay
          : '',
    createdAt: isoTime(sn?.publishedAt ?? new Date().toISOString()),
    isOwn: !!authorChannel && authorChannel === account.externalId,
  };
}

function auth(account: Account): Record<string, string> {
  return { Authorization: `Bearer ${account.token}` };
}

export const youtube: InboxAdapter = {
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
    const r = await httpJson({
      url: withParams(`${YT}/commentThreads`, {
        part: 'snippet,replies',
        videoId: postId,
        maxResults: COMMENTS_PAGE,
        order: 'time',
        textFormat: 'plainText',
        pageToken: cursor ?? undefined,
      }),
      provider: 'youtube',
      headers: auth(account),
    });
    if (r.status !== 200) throw ytError('YouTube comments', r.data, r.status);

    const threads = Array.isArray(r.data?.items) ? r.data.items : [];
    const items: NormalizedComment[] = [];
    const expand: string[] = [];

    for (const t of threads) {
      const top = t?.snippet?.topLevelComment;
      if (!top) continue;
      items.push(toComment(top, account));

      const embedded = Array.isArray(t?.replies?.comments) ? t.replies.comments : [];
      for (const c of embedded) items.push(toComment(c, account));

      // commentThreads embeds only the first few replies; threads that have
      // more than that get one bounded comments.list to fill the branch.
      if (Number(t?.snippet?.totalReplyCount ?? 0) > embedded.length) {
        expand.push(String(top?.id ?? ''));
      }
    }

    for (const parentId of expand.slice(0, MAX_REPLY_EXPANSIONS)) {
      if (!parentId) continue;
      try {
        const sub = await httpJson({
          url: withParams(`${YT}/comments`, {
            part: 'snippet',
            parentId,
            maxResults: COMMENTS_PAGE,
            textFormat: 'plainText',
          }),
          provider: 'youtube',
          headers: auth(account),
        });
        if (sub.status !== 200) continue;
        for (const c of Array.isArray(sub.data?.items) ? sub.data.items : []) {
          items.push(toComment(c, account));
        }
      } catch {
        // One unreadable branch must not hide the rest of the thread.
      }
    }

    return { items, cursor: r.data?.nextPageToken ?? null };
  },

  /** Newest uploads from the channel's uploads playlist, with the comment
   *  count from the video resource so the sweep only reads live threads.
   *  Real counts matter here: YouTube channels carry years of videos and each
   *  empty read still costs a unit. */
  async listOwnPosts(account, limit) {
    const n = Math.max(1, Math.min(limit, 50));
    const uploadsOf = (data: any): string =>
      String(data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? '');
    let ch = await httpJson({
      url: withParams(`${YT}/channels`, {
        part: 'contentDetails',
        ...(account.externalId ? { id: account.externalId } : { mine: 'true' }),
      }),
      provider: 'youtube',
      headers: auth(account),
    });
    if (ch.status !== 200) throw ytError('YouTube channel', ch.data, ch.status);
    let uploads = uploadsOf(ch.data);
    // Brand channels can lag the id lookup; the authorized token's own
    // channel is a reliable second try.
    if (!uploads) {
      ch = await httpJson({
        url: withParams(`${YT}/channels`, { part: 'contentDetails', mine: 'true' }),
        provider: 'youtube',
        headers: auth(account),
      });
      if (ch.status === 200) uploads = uploadsOf(ch.data);
    }
    if (!uploads) return [];

    const pl = await httpJson({
      url: withParams(`${YT}/playlistItems`, {
        part: 'snippet,contentDetails',
        playlistId: uploads,
        maxResults: n,
      }),
      provider: 'youtube',
      headers: auth(account),
    });
    if (pl.status !== 200) throw ytError('YouTube uploads', pl.data, pl.status);

    const videos = (Array.isArray(pl.data?.items) ? pl.data.items : [])
      .map((it: any) => ({
        externalId: String(it?.contentDetails?.videoId ?? ''),
        title: typeof it?.snippet?.title === 'string' ? it.snippet.title : '',
        thumbnail:
          it?.snippet?.thumbnails?.medium?.url ??
          it?.snippet?.thumbnails?.default?.url ??
          null,
        postedAt: isoDate(it?.contentDetails?.videoPublishedAt ?? it?.snippet?.publishedAt),
      }))
      .filter((v: any) => v.externalId);
    if (!videos.length) return [];

    const counts = new Map<string, number>();
    const stats = await httpJson({
      url: withParams(`${YT}/videos`, {
        part: 'statistics',
        id: videos.map((v: any) => v.externalId).join(','),
      }),
      provider: 'youtube',
      headers: auth(account),
    });
    if (stats.status === 200) {
      for (const v of Array.isArray(stats.data?.items) ? stats.data.items : []) {
        counts.set(String(v?.id ?? ''), Number(v?.statistics?.commentCount ?? 0));
      }
    }

    return videos.map((v: any) => ({
      externalId: v.externalId,
      commentCount: counts.get(v.externalId) ?? 0,
      url: `https://www.youtube.com/watch?v=${v.externalId}`,
      text: previewText(v.title),
      thumbnail: v.thumbnail,
      postedAt: v.postedAt,
      mediaKind: 'video',
    }));
  },

  async replyToComment(account, commentId, content): Promise<SendResult> {
    const text = content.text.trim();
    if (!text) throw new Error('YouTube reply is empty.');
    if (text.length > MAX_REPLY) {
      throw new Error(`YouTube replies are limited to ${MAX_REPLY} characters.`);
    }
    // parentId works for both a top-level comment and a nested reply, so the
    // same call answers whichever the user picked.
    const r = await httpJson({
      url: withParams(`${YT}/comments`, { part: 'snippet' }),
      provider: 'youtube',
      method: 'POST',
      headers: auth(account),
      body: {
        snippet: {
          parentId: commentId,
          textOriginal: text,
        },
      },
    });
    if (r.status !== 200 && r.status !== 201) {
      throw ytError('YouTube reply', r.data, r.status);
    }
    const externalId = String(r.data?.id ?? '');
    if (!externalId) throw new Error('YouTube accepted the reply but returned no id, refresh the thread.');
    return { externalId, sentAt: isoTime(r.data?.snippet?.publishedAt ?? new Date().toISOString()) };
  },
};
