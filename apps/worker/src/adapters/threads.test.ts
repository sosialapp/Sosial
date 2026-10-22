import { afterEach, describe, expect, it, vi } from 'vitest';
import { threads } from './threads';

const realFetch = globalThis.fetch;

const account = {
  id: 'c9', workspaceId: 'w1', provider: 'threads', externalId: '900',
  instanceUrl: null, displayId: '@sosial', token: 'th-token',
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

describe('threads adapter', () => {
  it('is comments-only', () => {
    expect(threads.capabilities()).toEqual({
      inbox: false, comments: true, hideComment: false, deleteComment: false,
    });
  });

  it('drops our own replies and keeps the parent comment id', async () => {
    stubRoutes((url) =>
      url.includes('/me?')
        ? [{ id: '900', username: 'sosial' }]
        : [{
            data: [
              {
                id: 'r_fan',
                text: 'love this',
                timestamp: '2026-10-22T10:00:00+0000',
                username: 'fan',
                profile_picture_url: 'https://cdn.example/fan.jpg',
                replied_to: { id: 'p1' },
                has_replies: false,
              },
              {
                id: 'r_own',
                text: 'thanks!',
                timestamp: '2026-10-22T10:05:00+0000',
                username: 'sosial',
                replied_to: { id: 'r_fan' },
                has_replies: false,
              },
            ],
          }],
    );
    const page = await threads.listComments(account, 'p1', null);
    expect(page.items.map((c) => c.externalId)).toEqual(['r_fan']);
    expect(page.items[0]).toMatchObject({
      parentExternalId: 'p1',
      authorName: '@fan',
      authorAvatar: 'https://cdn.example/fan.jpg',
      body: 'love this',
      createdAt: '2026-10-22T10:00:00.000Z',
      isOwn: false,
    });
  });

  it('enumerates own threads using has_replies', async () => {
    stubRoutes(() => [{ data: [{ id: 'p1', has_replies: true }, { id: 'p2', has_replies: false }] }]);
    await expect(threads.listOwnPosts?.(account, 10)).resolves.toEqual([
      { externalId: 'p1', commentCount: 1 },
      { externalId: 'p2', commentCount: 0 },
    ]);
  });

  it('replies through a TEXT container with reply_to_id, then publishes', async () => {
    const calls = stubRoutes((url) => {
      if (url.includes('/threads_publish')) return [{ id: 'r_new' }];
      if (url.includes('fields=status')) return [{ status: 'FINISHED' }];
      return [{ id: 'container_1' }];
    });
    const res = await threads.replyToComment(account, 'r_fan', { text: 'thanks!' });
    expect(res.externalId).toBe('r_new');
    const container = calls.find((c) => c.url.includes('/900/threads?'));
    expect(container?.url).toContain('media_type=TEXT');
    expect(container?.url).toContain('reply_to_id=r_fan');
    expect(container?.url).toContain('text=thanks!');
    expect(calls.some((c) => c.url.includes('threads_publish?creation_id=container_1'))).toBe(true);
  });

  it('refuses replies over 500 characters before calling the API', async () => {
    stubRoutes(() => [{}]);
    await expect(
      threads.replyToComment(account, 'r_fan', { text: 'x'.repeat(501) }),
    ).rejects.toThrow(/limited to 500/);
  });
});
