import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CHAIN_PROVIDERS,
  assertTikTokAudience,
  assertTikTokTargetsReady,
  createPost,
  fetchPosts,
  threadSegments,
} from './posts';
import { uploadMedia } from './mediaUpload';

vi.mock('./mediaUpload', () => ({ uploadMedia: vi.fn() }));

function fakeSb(mediaRows: { id: string; kind: string }[]) {
  const postMedia: unknown[] = [];
  let deletes = 0;
  const sb = {
    from(table: string) {
      const q: Record<string, unknown> = {};
      q.upsert = () => q;
      q.select = () => q;
      q.eq = () => q;
      q.insert = (row: unknown) => {
        if (table === 'post_media') postMedia.push(row);
        return Promise.resolve({ error: null });
      };
      q.delete = () => ({
        eq: () => {
          deletes += 1;
          return Promise.resolve({ error: null });
        },
      });
      q.in = () =>
        Promise.resolve({
          data: table === 'media_assets' ? mediaRows : null,
          error: null,
        });
      q.single = () => Promise.resolve({ data: { id: 'p1' }, error: null });
      return q;
    },
  };
  return { sb: sb as unknown as SupabaseClient, postMedia, deletes: () => deletes };
}

const base = {
  workspaceId: 'w1',
  userId: 'u1',
  title: 'Title',
  body: 'Body',
  mode: 'draft' as const,
  role: 'owner' as const,
  scheduleIso: null,
  channels: [],
};

describe('draft media reuse', () => {
  beforeEach(() => {
    vi.mocked(uploadMedia).mockReset();
  });

  it('links stored media ids without re-uploading bytes', async () => {
    const { sb, postMedia } = fakeSb([{ id: 'm1', kind: 'image' }]);
    const id = await createPost(sb, {
      ...base,
      media: [{ mediaId: 'm1', kind: 'image' }],
    });
    expect(id).toBe('p1');
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(postMedia).toEqual([{ post_id: 'p1', media_id: 'm1', position: 0 }]);
  });

  it('rejects media ids outside the workspace', async () => {
    const { sb, postMedia } = fakeSb([]);
    await expect(
      createPost(sb, { ...base, media: [{ mediaId: 'other', kind: 'image' }] }),
    ).rejects.toThrow(/no longer available/i);
    expect(postMedia).toEqual([]);
  });

  it('clears old links when every attachment was removed', async () => {
    const { sb, postMedia, deletes } = fakeSb([]);
    await createPost(sb, { ...base, clientId: 'c1', media: [] });
    expect(deletes()).toBe(1);
    expect(postMedia).toEqual([]);
  });
});

describe('preview signing', () => {
  it('chunks R2 signing so more than 100 assets still get previews', async () => {
    const media = Array.from({ length: 101 }, (_, i) => ({
      id: `m${i}`,
      workspace_id: 'w1',
      storage_path: `w1/${i}.jpg`,
      storage_backend: 'r2',
      kind: 'image',
      signed_url: undefined as string | undefined,
    }));
    const rows = [{ id: 'p1', post_media: media.map((m, i) => ({ position: i, media_assets: m })) }];
    const invoke = vi.fn(async (_name: string, opts: { body: { items: { path: string }[] } }) => ({
      data: { urls: opts.body.items.map((it) => `https://r2/${it.path}`) },
      error: null,
    }));
    const sb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: rows, error: null }),
          }),
        }),
      }),
      functions: { invoke },
      storage: { from: () => ({ createSignedUrls: vi.fn() }) },
    } as unknown as SupabaseClient;

    await fetchPosts(sb, 'w1');

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(media[0].signed_url).toBe('https://r2/w1/0.jpg');
    expect(media[100].signed_url).toBe('https://r2/w1/100.jpg');
  });
});

describe('chain threads (worker parity)', () => {
  it('covers exactly the reply-capable providers', () => {
    expect([...CHAIN_PROVIDERS].sort()).toEqual(['bluesky', 'mastodon', 'threads', 'x']);
    for (const p of ['instagram', 'tiktok', 'youtube', 'facebook', 'pinterest', 'linkedin']) {
      expect(CHAIN_PROVIDERS).not.toContain(p);
    }
  });

  it('trims segments and drops empties for options.thread', () => {
    expect(threadSegments(['  hello  ', '', '   ', 'world'])).toEqual(['hello', 'world']);
    expect(threadSegments([])).toEqual([]);
  });
});

describe('assertTikTokAudience', () => {
  const tt = [{ provider: 'tiktok' }];

  it('refuses a queued TikTok post without an audience', () => {
    expect(() => assertTikTokAudience('now', tt)).toThrow(/audience/);
    expect(() => assertTikTokAudience('schedule', tt, { tiktok: { ttPrivacy: '' } })).toThrow(/audience/);
  });

  it('allows drafts, explicit audiences and non-TikTok posts', () => {
    expect(() => assertTikTokAudience('draft', tt)).not.toThrow();
    expect(() => assertTikTokAudience('now', tt, { tiktok: { ttPrivacy: 'SELF_ONLY' } })).not.toThrow();
    expect(() => assertTikTokAudience('now', [{ provider: 'x' }])).not.toThrow();
  });
});

describe('assertTikTokTargetsReady', () => {
  const sbWith = (rows: { options: Record<string, unknown> | null }[]) => {
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = () => q;
    q.in = () => Promise.resolve({ data: rows, error: null });
    return { from: () => q } as unknown as SupabaseClient;
  };

  it('refuses a draft whose TikTok target has no audience', async () => {
    await expect(assertTikTokTargetsReady(sbWith([{ options: {} }]), 'p1')).rejects.toThrow(/audience/);
    await expect(assertTikTokTargetsReady(sbWith([{ options: null }]), 'p1')).rejects.toThrow(/audience/);
  });

  it('passes when every TikTok target has an audience, or there are none', async () => {
    await expect(
      assertTikTokTargetsReady(sbWith([{ options: { ttPrivacy: 'SELF_ONLY' } }]), 'p1'),
    ).resolves.toBeUndefined();
    await expect(assertTikTokTargetsReady(sbWith([]), 'p1')).resolves.toBeUndefined();
  });
});
