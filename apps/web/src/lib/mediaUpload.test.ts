import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { uploadMedia } from './mediaUpload';

const USER = '11111111-1111-1111-1111-111111111111';
const WS = '22222222-2222-2222-2222-222222222222';

/** A non-2xx as supabase-js reports it: no data, a generic message, and the
 *  edge's own reason only in the Response on error.context. */
function rejected(status: number, reason: string) {
  return {
    data: null,
    error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: new Response(JSON.stringify({ error: reason }), { status }),
    }),
  };
}

/**
 * Stands in for the `media` edge function as seen by the service_role client:
 * like the real one, it rejects any action that doesn't name the acting user.
 */
function fakeServiceEdge(multipart = false, initRejection?: { status: number; error: string }) {
  const actions: string[] = [];
  const invoke = vi.fn(async (_fn: string, { body }: { body: Record<string, unknown> }) => {
    if (body.userId !== USER) return rejected(400, 'Service calls must include a valid userId.');
    actions.push(String(body.action)); // accepted calls only
    if (body.action === 'init' && initRejection) return rejected(initRejection.status, initRejection.error);
    switch (body.action) {
      case 'init':
        return {
          data: {
            mediaId: 'm1',
            key: 'post-media/prod/ws/m1/a.bin',
            upload: multipart
              ? { mode: 'multipart', uploadId: 'u1', partSize: 4, totalParts: 2 }
              : { mode: 'single', url: 'https://r2.test/put' },
            thumbUpload: null,
          },
          error: null,
        };
      case 'sign-parts':
        return { data: { urls: [{ partNumber: 1, url: 'https://r2.test/part' }] }, error: null };
      case 'complete':
        return { data: { mediaId: 'm1', status: 'ready' }, error: null };
      default:
        return { data: { ok: true }, error: null };
    }
  });
  return { sb: { functions: { invoke } } as unknown as SupabaseClient, actions };
}

const file = () => new File([new Uint8Array(8)], 'a.bin', { type: 'video/mp4' });

describe('uploadMedia as a service_role caller (public API)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 200, headers: { etag: '"e"' } }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('names the user on complete, so a single-PUT upload reaches ready', async () => {
    const { sb, actions } = fakeServiceEdge();
    const res = await uploadMedia(sb, WS, file(), 'video', undefined, USER);
    expect(res.mediaId).toBe('m1');
    expect(actions).toEqual(['init', 'complete']);
  });

  it('names the user on every multipart action', async () => {
    const { sb, actions } = fakeServiceEdge(true);
    await uploadMedia(sb, WS, file(), 'video', undefined, USER);
    expect(actions).toEqual(['init', 'sign-parts', 'sign-parts', 'complete']);
  });

  it("reports the edge's own reason, not the generic non-2xx message", async () => {
    const { sb } = fakeServiceEdge(false, { status: 413, error: 'Not enough storage left on this plan.' });
    await expect(uploadMedia(sb, WS, file(), 'video', undefined, USER)).rejects.toThrow(
      'Not enough storage left on this plan.',
    );
  });

  it('names the user on abort when the PUT fails', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    const { sb, actions } = fakeServiceEdge();
    await expect(uploadMedia(sb, WS, file(), 'video', undefined, USER)).rejects.toThrow('upload part failed');
    expect(actions).toEqual(['init', 'abort']);
  }, 10_000);
});
