import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES,
  checkCompatibility,
  providerStatus,
} from './compat';

const ch = (provider: string, metadata?: Record<string, unknown>) => ({ provider, metadata });
const part = (body: string, kinds: string[] = []) => ({ body, kinds });

describe('compat profiles', () => {
  it('covers the live channels plus the manual and staged OAuth additions', () => {
    expect(Object.keys(CAPABILITIES).sort()).toEqual([
      'bluesky',
      'devto',
      'discord',
      'facebook',
      'ghost',
      'gmb',
      'hashnode',
      'instagram',
      'linkedin',
      'mastodon',
      'pinterest',
      'reddit',
      'telegram',
      'threads',
      'tiktok',
      'vk',
      'wordpress',
      'x',
      'youtube',
    ]);
  });

  it('declares the hard requirements from the spec', () => {
    expect(CAPABILITIES.youtube.requiresVideo).toBe(true);
    expect(CAPABILITIES.instagram.requiresMedia).toBe(true);
    expect(CAPABILITIES.tiktok.requiresMedia).toBe(true);
    expect(CAPABILITIES.pinterest.requiresMedia).toBe(true);
    expect(CAPABILITIES.pinterest.boardRequired).toBe(true);
    expect(CAPABILITIES.facebook.requiresMedia).toBe(false);
    expect(CAPABILITIES.linkedin.requiresMedia).toBe(false);
  });
});

describe('checkCompatibility', () => {
  it('passes a clean multi-channel draft', () => {
    const issues = checkCompatibility(
      [ch('x'), ch('threads'), ch('linkedin')],
      { thread: false, parts: [part('hello')] },
    );
    expect(issues).toEqual([]);
  });

  it('requires video for youtube, media for instagram/tiktok', () => {
    const noMedia = { thread: false, parts: [part('hi')] };
    expect(
      checkCompatibility([ch('youtube')], noMedia).map((i) => i.message),
    ).toEqual(['YouTube needs a video.']);
    expect(
      checkCompatibility([ch('instagram')], noMedia).map((i) => i.message),
    ).toEqual(['Instagram needs a photo or video.']);
    expect(
      checkCompatibility([ch('youtube')], {
        thread: false,
        parts: [part('hi', ['video'])],
      }),
    ).toEqual([]);
    // A photo satisfies instagram but not youtube.
    expect(
      checkCompatibility([ch('youtube'), ch('instagram')], {
        thread: false,
        parts: [part('hi', ['image'])],
      }).map((i) => i.provider),
    ).toEqual(['youtube']);
  });

  it('requires a board for pinterest', () => {
    const draft = { thread: false, parts: [part('hi', ['image'])] };
    expect(checkCompatibility([ch('pinterest')], draft)).toHaveLength(1);
    expect(
      checkCompatibility([ch('pinterest', { pinBoardId: 'b1' })], draft),
    ).toEqual([]);
  });

  it('rejects threads on non-thread channels', () => {
    const issues = checkCompatibility([ch('instagram')], {
      thread: true,
      parts: [part('a'), part('b')],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/doesn't do threads/);
    expect(
      checkCompatibility([ch('x'), ch('threads'), ch('mastodon'), ch('bluesky')], {
        thread: true,
        parts: [part('a'), part('b')],
      }),
    ).toEqual([]);
  });

  it('enforces per-part character limits', () => {
    const issues = checkCompatibility([ch('x')], {
      thread: true,
      parts: [part('ok'), part('y'.repeat(300))],
    });
    expect(issues.map((i) => i.message)).toEqual(['X part 2 is 20 characters over the limit.']);
  });

  it('skips providers it cannot judge', () => {
    expect(
      checkCompatibility([ch('tumblr')], { thread: true, parts: [part('x'.repeat(99999))] }),
    ).toEqual([]);
  });
});

describe('providerStatus', () => {
  it('reports the worst level per provider', () => {
    const issues = checkCompatibility([ch('youtube'), ch('x')], {
      thread: false,
      parts: [part('hi')],
    });
    expect(providerStatus('youtube', issues)).toBe('error');
    expect(providerStatus('x', issues)).toBe('ok');
    expect(providerStatus('threads', issues)).toBe('ok');
  });
});
