import { describe, expect, it } from 'vitest';
import {
  assertMediaAllowed,
  formatBytes,
  IMAGE_MAX_BYTES,
  YOUTUBE_MAX_BYTES,
  YOUTUBE_MAX_DURATION_MS,
} from './mediaLimits';

const GB = 1024 * 1024 * 1024;

describe('formatBytes', () => {
  it('rounds to human units', () => {
    expect(formatBytes(512)).toBe('1 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatBytes(3.4 * 1024 * 1024 * 1024)).toBe('3 GB');
  });
});

describe('assertMediaAllowed', () => {
  const noHead = async () => null;

  it('passes media inside every cap', async () => {
    await expect(
      assertMediaAllowed(
        'tiktok',
        [{ kind: 'image', byte_size: 1024 }, { kind: 'video', byte_size: 900 * 1024 * 1024 }],
        noHead,
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects an image over 10 MB for any provider', async () => {
    await expect(
      assertMediaAllowed('bluesky', [{ kind: 'image', byte_size: IMAGE_MAX_BYTES + 1 }], noHead),
    ).rejects.toThrow(/10 MB/);
  });

  it('rejects a video over 1 GB for non-YouTube providers', async () => {
    await expect(
      assertMediaAllowed('x', [{ kind: 'video', byte_size: GB + 1 }], noHead),
    ).rejects.toThrow(/1 GB/);
  });

  it('allows a 5 GB video for youtube but not tiktok', async () => {
    const big = 5 * GB;
    await expect(
      assertMediaAllowed('youtube', [{ kind: 'video', byte_size: big }], noHead),
    ).resolves.toBeUndefined();
    await expect(
      assertMediaAllowed('tiktok', [{ kind: 'video', byte_size: big }], noHead),
    ).rejects.toThrow(/limit/);
  });

  it('rejects a YouTube video over 4 hours', async () => {
    await expect(
      assertMediaAllowed(
        'youtube',
        [{ kind: 'video', byte_size: 1024, duration_ms: YOUTUBE_MAX_DURATION_MS + 1 }],
        noHead,
      ),
    ).rejects.toThrow(/4 hour/);
  });

  it('falls back to the head resolver for legacy rows with null size', async () => {
    const head = async () => IMAGE_MAX_BYTES + 5;
    await expect(
      assertMediaAllowed('facebook', [{ kind: 'image', byte_size: null }], head),
    ).rejects.toThrow(/10 MB/);
  });

  it('skips the check when size is unknown everywhere', async () => {
    await expect(
      assertMediaAllowed('x', [{ kind: 'video', byte_size: null }], noHead),
    ).resolves.toBeUndefined();
  });
});
