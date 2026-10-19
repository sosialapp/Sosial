/**
 * Client-side avatar downscale.
 *
 * The self-hosted edge runtime ships Deno without a usable `ImageDecoder`, so
 * the `profile-avatar` / `team-avatar` functions cannot re-encode an image
 * themselves — they reject anything over 300 KB they can't decode ("Could not
 * compress this image, try a smaller one."). Shrinking in the browser first
 * means the function always receives a few-KB JPEG it stores verbatim.
 */
const AVATAR_MAX_DIM = 256;
const AVATAR_QUALITY = 0.82;

/** Decode a picked file, preferring createImageBitmap (EXIF-aware, fast). */
async function decode(
  file: File,
): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error('image decode failed'));
      el.src = url;
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Downscale to a ≤256 px JPEG data URL (white behind any transparency).
 * Returns null when the browser can't decode the format (e.g. HEIC in Chrome),
 * so the caller can show a clear message instead of a 422 from the function.
 */
export async function fileToAvatarDataUrl(file: File): Promise<string | null> {
  const src = await decode(file);
  if (!src) return null;

  const isImg = typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement;
  const width = isImg ? (src as HTMLImageElement).naturalWidth : (src as ImageBitmap).width;
  const height = isImg ? (src as HTMLImageElement).naturalHeight : (src as ImageBitmap).height;
  if (!width || !height) return null;

  const scale = Math.min(1, AVATAR_MAX_DIM / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
  if ('close' in src && typeof src.close === 'function') src.close();

  return canvas.toDataURL('image/jpeg', AVATAR_QUALITY);
}
