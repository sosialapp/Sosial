import { afterEach, describe, expect, it, vi } from 'vitest';
import { youtube } from './youtube';

const realFetch = globalThis.fetch;

const account = {
  id: 'cy', workspaceId: 'w1', provider: 'youtube', externalId: 'UC_me',
  instanceUrl: null, displayId: 'Sosial', token: 'yt-token',
};

function stubRoutes(handler: (url: string, init: any) => [unknown, number?]) {
  const calls: { url: string; init: any }[] = [];
  globalThis.fetch = vi.fn(async (url: any, init: any) => {
    const [payload, status = 200] = handler(String(url), init);
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('youtube adapter', () => {
  it('is comments-only', () => {
    expect(youtube.capabilities()).toEqual({
      inbox: false, comments: true, hideComment: false, deleteComment: false,
    });
  });

  it('normalizes threads, embedded replies and our own reply', async () => {
    stubRoutes(() => [{
      items: [{
        snippet: {
          totalReplyCount: 2,
          topLevelComment: {
            id: 'c_top',
            snippet: {
              authorDisplayName: 'Fan',
              authorProfileImageUrl: 'https://cdn.example/fan.jpg',
              authorChannelId: { value: 'UC_fan' },
              textOriginal: 'great video',
              publishedAt: '2026-10-22T10:00:00Z',
            },
          },
        },
        replies: {
          comments: [
            {
              id: 'c_own',
              snippet: {
                parentId: 'c_top',
                authorDisplayName: 'Sosial',
                authorChannelId: { value: 'UC_me' },
                textOriginal: 'thanks!',
                publishedAt: '2026-10-22T10:05:00Z',
              },
            },
            {
              id: 'c_fan2',
              snippet: {
                parentId: 'c_top',
                authorDisplayName: 'Fan',
                authorChannelId: { value: 'UC_fan' },
                textOriginal: 'agreed',
                publishedAt: '2026-10-22T10:06:00Z',
              },
            },
          ],
        },
      }],
    }]);

    const page = await youtube.listComments(account, 'vid1', null);
    expect(page.items.map((c) => c.externalId)).toEqual(['c_top', 'c_own', 'c_fan2']);
    expect(page.items[0]).toMatchObject({
      parentExternalId: null,
      authorName: 'Fan',
      authorAvatar: 'https://cdn.example/fan.jpg',
      body: 'great video',
      createdAt: '2026-10-22T10:00:00.000Z',
      isOwn: false,
    });
    expect(page.items[1]).toMatchObject({ parentExternalId: 'c_top', isOwn: true });
    expect(page.cursor).toBeNull();
  });

  it('walks threads that carry more replies than the page embeds', async () => {
    const calls = stubRoutes((url) =>
      url.includes('/comments?')
        ? [{ items: [{
            id: 'c_deep',
            snippet: {
              parentId: 'c_top',
              authorDisplayName: 'Deep',
              authorChannelId: { value: 'UC_x' },
              textOriginal: 'deep reply',
              publishedAt: '2026-10-22T10:10:00Z',
            },
          }] }]
        : [{ items: [{
            snippet: {
              totalReplyCount: 9,
              topLevelComment: {
                id: 'c_top',
                snippet: { authorDisplayName: 'Fan', authorChannelId: { value: 'UC_fan' }, textOriginal: 'hi', publishedAt: '2026-10-22T10:00:00Z' },
              },
            },
          }] }],
    );

    const page = await youtube.listComments(account, 'vid1', null);
    expect(page.items.map((c) => c.externalId)).toEqual(['c_top', 'c_deep']);
    expect(page.items[1]).toMatchObject({ parentExternalId: 'c_top', body: 'deep reply' });
    expect(calls.some((c) => c.url.includes('parentId=c_top'))).toBe(true);
  });

  it('enumerates uploads with the real comment count', async () => {
    const calls = stubRoutes((url) => {
      if (url.includes('/channels?')) {
        return [{ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU_me' } } }] }];
      }
      if (url.includes('/playlistItems?')) {
        return [{ items: [
          {
            contentDetails: { videoId: 'vid1', videoPublishedAt: '2026-10-20T08:00:00Z' },
            snippet: { title: 'Launch day', thumbnails: { medium: { url: 'https://cdn.example/v1.jpg' } } },
          },
          {
            contentDetails: { videoId: 'vid2', videoPublishedAt: '2026-10-18T08:00:00Z' },
            snippet: { title: 'Quiet one' },
          },
        ] }];
      }
      return [{ items: [
        { id: 'vid1', statistics: { commentCount: '12' } },
        { id: 'vid2', statistics: { commentCount: '0' } },
      ] }];
    });

    await expect(youtube.listOwnPosts?.(account, 10)).resolves.toEqual([
      {
        externalId: 'vid1',
        commentCount: 12,
        url: 'https://www.youtube.com/watch?v=vid1',
        text: 'Launch day',
        thumbnail: 'https://cdn.example/v1.jpg',
        postedAt: '2026-10-20T08:00:00.000Z',
        mediaKind: 'video',
      },
      {
        externalId: 'vid2',
        commentCount: 0,
        url: 'https://www.youtube.com/watch?v=vid2',
        text: 'Quiet one',
        thumbnail: null,
        postedAt: '2026-10-18T08:00:00.000Z',
        mediaKind: 'video',
      },
    ]);
    expect(calls.some((c) => c.url.includes('/channels?part=contentDetails&id=UC_me'))).toBe(true);
    expect(calls.some((c) => c.url.includes('part=statistics'))).toBe(true);
  });

  it('answers with comments.insert (parentId + textOriginal)', async () => {
    const calls = stubRoutes(() => [{
      id: 'c_new',
      snippet: { publishedAt: '2026-10-22T11:00:00Z' },
    }]);
    const res = await youtube.replyToComment(account, 'c_top', { text: 'thanks!' });
    expect(res.externalId).toBe('c_new');
    expect(res.sentAt).toBe('2026-10-22T11:00:00.000Z');
    const post = calls.find((c) => c.init?.method === 'POST');
    expect(post?.url).toContain('/comments?part=snippet');
    expect(JSON.parse(post?.init?.body)).toEqual({
      snippet: { parentId: 'c_top', textOriginal: 'thanks!' },
    });
  });

  it('refuses replies over 10000 characters before calling the API', async () => {
    stubRoutes(() => [{}]);
    await expect(
      youtube.replyToComment(account, 'c_top', { text: 'x'.repeat(10001) }),
    ).rejects.toThrow(/limited to 10000/);
  });
});