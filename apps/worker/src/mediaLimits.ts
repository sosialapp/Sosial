/**
 * Publish-time media ruleset (per-platform size/duration guards).
 *
 * Mirrors apps/web/src/lib/mediaLimits.ts: the composer pre-checks uploads,
 * and this module is the final gate at publish time. Rules that a target
 * breaks fail THAT target with a clear reason — siblings still publish.
 */

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
/** Hard ceiling enforced at upload (edge init). */
export const VIDEO_MAX_BYTES = 10 * 1024 * 1024 * 1024;
/** Per-platform video caps — everything except YouTube takes 1 GB. */
export const VIDEO_PLATFORM_MAX_BYTES: Record<string, number> = {
  youtube: 10 * 1024 * 1024 * 1024,
};
export const YOUTUBE_MAX_BYTES = VIDEO_PLATFORM_MAX_BYTES.youtube;
export const YOUTUBE_MAX_DURATION_MS = 4 * 60 * 60 * 1000;

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${Math.round(n / (1024 * 1024 * 1024))} GB`;
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function videoCapFor(provider: string): number {
  return VIDEO_PLATFORM_MAX_BYTES[provider] ?? 1024 * 1024 * 1024;
}

/**
 * Throw when the target's provider cannot take this media set. `sizes`
 * resolves a real byte size for items whose byte_size is unknown (legacy
 * rows) — usually storageHeadSize, so the guard still holds for them.
 */
export async function assertMediaAllowed<M extends { kind: string; byte_size: number | null | undefined; duration_ms?: number | null | undefined }>(
  provider: string,
  media: M[],
  sizes: (m: M) => Promise<number | null>,
): Promise<void> {
  for (const m of media) {
    const size = m.byte_size ?? (await sizes(m));
    if (m.kind === 'image' && size !== null && size > IMAGE_MAX_BYTES) {
      throw new Error(`Image is over the ${formatBytes(IMAGE_MAX_BYTES)} limit for ${provider}.`);
    }
    if (m.kind === 'video') {
      const cap = videoCapFor(provider);
      if (size !== null && size > cap) {
        throw new Error(
          provider === 'youtube'
            ? `Video is over YouTube's ${formatBytes(cap)} limit.`
            : `Video is over ${provider}'s ${formatBytes(cap)} limit — try YouTube for large files.`,
        );
      }
      if (
        provider === 'youtube' &&
        typeof m.duration_ms === 'number' &&
        m.duration_ms > YOUTUBE_MAX_DURATION_MS
      ) {
        throw new Error('Video is over YouTube’s 4 hour limit.');
      }
    }
  }
}
