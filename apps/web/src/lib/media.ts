/**
 * Supabase Storage + Cloudflare R2 URL helpers.
 *
 * Media in the app is served from a private store through short-lived signed
 * URLs. Legacy Supabase URLs point at `/storage/v1/object/sign/...` and stream
 * the FULL original bytes — a 4 MB phone photo is downloaded even for an 80 px
 * grid tile. That was the app's single biggest source of egress.
 *
 * Two mechanisms now keep grids cheap:
 *   1. Client-generated thumbnails uploaded alongside the original
 *      (`media_assets.thumb_path`, served as `thumb_url`). Grids use these.
 *   2. `imageThumb` rewrites a legacy Supabase signed URL to the image-transform
 *      endpoint (`/storage/v1/render/image/sign/...`) as a fallback.
 *
 * R2 URLs are already presigned and can't be server-transformed, so for those
 * assets a stored `thumb_url` is the only cheap option — `mediaThumbUrl` picks
 * it automatically.
 */

/** Widths the UI actually renders at, rounded up to keep transforms cacheable. */
export const THUMB_WIDTHS = { xs: 96, sm: 160, md: 320, lg: 640, xl: 1080 } as const;

/**
 * Rewrite a signed storage URL to a resized variant. Returns the input
 * unchanged when it is not a Supabase object URL (e.g. a blob:, data:, an R2
 * URL, or an already-transformed URL) so callers can pass anything safely.
 */
export function imageThumb(url: string | null | undefined, width: number, quality = 70): string | undefined {
  if (!url) return undefined;
  // Only ever rewrite the sign endpoint; leave public/render/blob URLs alone.
  const marker = '/storage/v1/object/sign/';
  const at = url.indexOf(marker);
  if (at === -1) return url;
  const head = url.slice(0, at);
  const tail = url.slice(at + marker.length); // path + query (token=...)
  // Already has a query? Preserve it — the token must survive.
  const sep = tail.includes('?') ? '&' : '?';
  return `${head}/storage/v1/render/image/sign/${tail}${sep}width=${width}&quality=${quality}&resize=contain`;
}

/** A small helper for the common grid-tile case. */
export function gridThumb(url: string | null | undefined): string | undefined {
  return imageThumb(url, THUMB_WIDTHS.sm);
}

/** The minimum media shape the thumb picker needs. */
export interface ThumbSource {
  kind?: string | null;
  signed_url?: string | null;
  thumb_url?: string | null;
}

/**
 * Best available small image URL for a media row:
 *   stored thumbnail (client-generated, works for R2) → legacy transform of the
 *   signed original → undefined when there is nothing to show.
 * Videos return their stored thumb (poster) rather than the full video bytes.
 */
export function mediaThumbUrl(
  m: ThumbSource | null | undefined,
  width: number = THUMB_WIDTHS.sm,
  quality = 70,
): string | undefined {
  if (!m) return undefined;
  if (m.thumb_url) return m.thumb_url;
  if (m.kind === 'video') return undefined; // no originals for video tiles
  return imageThumb(m.signed_url, width, quality);
}

/** The small helper for grid tiles that take a media row. */
export function gridThumbUrl(m: ThumbSource | null | undefined): string | undefined {
  return mediaThumbUrl(m, THUMB_WIDTHS.sm);
}

