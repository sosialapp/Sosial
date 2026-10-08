/**
 * Supabase Storage URL helpers.
 *
 * Media in the app is served from a private bucket through short-lived signed
 * URLs. Those URLs point at `/storage/v1/object/sign/...` and stream the FULL
 * original bytes — a 4 MB phone photo is downloaded even for an 80 px grid tile.
 * That is the app's single biggest source of Supabase egress.
 *
 * `imageThumb` rewrites a signed object URL to Supabase's image-transform
 * endpoint (`/storage/v1/render/image/sign/...`) so the server resizes before
 * sending. Video URLs pass through untouched (transforms are images-only).
 */

/** Widths the UI actually renders at, rounded up to keep transforms cacheable. */
export const THUMB_WIDTHS = { xs: 96, sm: 160, md: 320, lg: 640, xl: 1080 } as const;

/**
 * Rewrite a signed storage URL to a resized variant. Returns the input
 * unchanged when it is not a Supabase object URL (e.g. a blob:, data:, or an
 * already-transformed URL) so callers can pass anything safely.
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
