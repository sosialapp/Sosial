/**
 * Product media rules — mobile mirror of apps/web/src/lib/mediaLimits.ts.
 * The composer pre-checks picks here; the worker re-checks per platform at
 * publish time; the edge `media` function enforces the upload ceilings.
 */
import * as FileSystem from 'expo-file-system/legacy';

/** Images: ≤10 MB everywhere they can go. */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** Video upload ceiling — the YouTube limit, also the hard R2 object ceiling. */
export const VIDEO_MAX_BYTES = 10 * 1024 * 1024 * 1024;

/** YouTube: ≤10 GB AND ≤4 hours. */
export const YOUTUBE_MAX_BYTES = 10 * 1024 * 1024 * 1024;
export const YOUTUBE_MAX_DURATION_MS = 4 * 60 * 60 * 1000;

/** Every other video platform: ≤1 GB. */
export const VIDEO_PLATFORM_MAX_BYTES = 1 * 1024 * 1024 * 1024;

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const rounded = v >= 10 || i <= 1 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${rounded} ${units[i]}`;
}

export interface MediaFile {
  name: string;
  size: number;
  kind: 'image' | 'video';
  durationMs?: number | null;
}

/**
 * Pre-upload validation for a single file. Returns an error message when the
 * file can't be uploaded at all, or null when it's fine for the bucket.
 */
export function validateUpload(f: MediaFile): string | null {
  if (f.size <= 0) return `${f.name} looks empty.`;
  if (f.kind === 'image' && f.size > IMAGE_MAX_BYTES) {
    return `${f.name} is ${formatBytes(f.size)} — images can be up to 10 MB.`;
  }
  if (f.kind === 'video' && f.size > VIDEO_MAX_BYTES) {
    return `${f.name} is ${formatBytes(f.size)} — videos can be up to 10 GB.`;
  }
  return null;
}

/**
 * Per-platform warnings for the chosen targets. Non-blocking: the post still
 * saves, but the listed channels won't receive this file at publish time
 * (the worker fails just that target with the same reason).
 */
export function targetWarnings(files: MediaFile[], providers: string[]): string[] {
  const out: string[] = [];
  for (const p of providers) {
    for (const f of files) {
      if (f.kind !== 'video') continue;
      if (p === 'youtube') {
        if (f.size > YOUTUBE_MAX_BYTES) out.push(`${f.name} is over YouTube's 10 GB limit.`);
        else if (f.durationMs && f.durationMs > YOUTUBE_MAX_DURATION_MS) {
          out.push(`${f.name} is longer than YouTube's 4-hour limit.`);
        }
      } else if (f.size > VIDEO_PLATFORM_MAX_BYTES) {
        out.push(`${f.name} is over 1 GB — too big for ${p}.`);
      }
    }
  }
  return [...new Set(out)];
}

/** Bytes on disk for a local file URI (0 when it can't be stat'd). */
export async function statSize(uri: string): Promise<number> {
  try {
    const info: any = await FileSystem.getInfoAsync(uri);
    return info?.exists && typeof info.size === 'number' ? info.size : 0;
  } catch {
    return 0;
  }
}
