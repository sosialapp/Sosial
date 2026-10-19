import { storageDownload, storageSign } from './rest';

/**
 * Inline article-body images.
 *
 * The web serializer (`apps/web/src/lib/article.ts`) cannot bake a URL into the
 * stored HTML/Markdown: article bytes live in private post-media and any signed
 * URL would expire long before a scheduled post goes out. So it emits a marker
 * instead — `sosial-media:<storage path>` — and the worker resolves it at
 * publish time, one of two ways:
 *
 *   - Dev.to / Hashnode: mint a fresh 7-day signed URL. Both platforms fetch
 *     and cache the image on publish, so the URL only has to survive that one
 *     request.
 *   - WordPress / Ghost: download the bytes and re-upload them to the site's
 *     own media library, which returns a permanent URL. Hotlinking an expiring
 *     URL would break readers' images a week after publishing.
 *
 * Every substitution is best-effort: a single failure leaves the marker (or
 * falls back to a signed URL) so the rest of the article still ships.
 */

export const ARTICLE_MEDIA_PREFIX = 'sosial-media:';

/** Marker body: storage paths have no whitespace or quotes, so this is safe. */
const MARKER = /sosial-media:([^\s"'()<>]+)/g;

export function articleMediaPaths(content: string): string[] {
  const out = new Set<string>();
  for (const m of content.matchAll(MARKER)) out.add(m[1]);
  return [...out];
}

function extOf(path: string): string {
  const name = path.split('/').pop() ?? '';
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : 'jpg';
}

export function mimeOf(path: string): string {
  switch (extOf(path)) {
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/jpeg';
  }
}

function escapeAttr(url: string): string {
  return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Replace every marker with a freshly signed post-media URL. For platforms that
 * fetch + cache at publish (Dev.to, Hashnode).
 */
export async function signArticleMedia(content: string, expiresIn = 7 * 24 * 3600): Promise<string> {
  const paths = articleMediaPaths(content);
  if (!paths.length) return content;
  const map = new Map<string, string>();
  for (const p of paths) {
    try {
      map.set(p, await storageSign('post-media', p, expiresIn));
    } catch {
      /* leave the marker: the rest of the article still publishes */
    }
  }
  return content.replace(MARKER, (m, p: string) => map.get(p) ?? m);
}

/**
 * Replace every marker by uploading the bytes to the platform via `upload`
 * (returns the platform's permanent URL — WordPress media, Ghost images).
 * Falls back to a signed URL when an upload fails. `html` escapes the
 * substituted URL for attribute context.
 */
export async function uploadArticleMedia(
  content: string,
  upload: (bytes: Buffer, path: string) => Promise<string>,
  html = false,
  fallbackTtl = 7 * 24 * 3600,
): Promise<string> {
  const paths = articleMediaPaths(content);
  if (!paths.length) return content;
  const map = new Map<string, string>();
  for (const p of paths) {
    let url = '';
    try {
      const bytes = await storageDownload(await storageSign('post-media', p), 25 * 1024 * 1024);
      url = await upload(bytes, p);
    } catch {
      url = '';
    }
    if (!url) {
      try {
        url = await storageSign('post-media', p, fallbackTtl);
      } catch {
        url = '';
      }
    }
    if (url) map.set(p, html ? escapeAttr(url) : url);
  }
  return content.replace(MARKER, (m, p: string) => map.get(p) ?? m);
}
