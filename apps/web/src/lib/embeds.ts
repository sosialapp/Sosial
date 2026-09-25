/**
 * Pure URL → embed transforms (no JSX — safe to import from tests, the
 * serializer and client components alike).
 */

/** YouTube / Vimeo URLs → privacy-friendly embed src; anything else → null
 *  (callers fall back to a plain link). */
export function embedUrl(url: string): string | null {
  const u = url.trim();
  const m: RegExpMatchArray | null =
    u.match(/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?.*v=([\w-]{6,})/) ??
    u.match(/^(?:https?:\/\/)?youtu\.be\/([\w-]{6,})/) ??
    u.match(/^(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:shorts|live|embed)\/([\w-]{6,})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[m.length - 1]}`;
  const v = u.match(/^(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com\/(\d+)/);
  if (v) return `https://player.vimeo.com/video/${v[1]}`;
  return null;
}

/** Static social/video/music embeds — pure URL transforms, no JS SDKs, so
 *  the published HTML renders them without any client script. Returns the
 *  iframe src plus the aspect box the embed wants, or null when the platform
 *  has no static iframe (X, LinkedIn, …) and a link card should render. */
export function resolveEmbed(
  url: string,
): { src: string; ratio: string; height?: number } | null {
  const u = url.trim();
  if (!u) return null;
  const video = embedUrl(u);
  if (video) return { src: video, ratio: '16 / 9' };

  let m: RegExpMatchArray | null;
  // Spotify — player height differs per kind.
  m = u.match(/^(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show)\/([\w]+)/);
  if (m) {
    const [, kind, id] = m;
    if (kind === 'track' || kind === 'episode') {
      return { src: `https://open.spotify.com/embed/${kind}/${id}`, ratio: '1 / 1', height: 152 };
    }
    return { src: `https://open.spotify.com/embed/${kind}/${id}`, ratio: '1 / 1', height: 352 };
  }
  // TikTok video → static embed frame.
  m = u.match(/^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.\-]+\/video\/(\d+)/);
  if (m) return { src: `https://www.tiktok.com/embed/v2/${m[1]}`, ratio: '33 / 56' };
  // Instagram post / reel → static embed frame.
  m = u.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/(p|reel|tv)\/([\w-]+)/);
  if (m) return { src: `https://www.instagram.com/${m[1]}/${m[2]}/embed`, ratio: '4 / 5' };
  // Facebook post / video → plugins iframe (static, no SDK).
  if (/^https?:\/\/(www\.|m\.)?facebook\.com\/[\w./\-?=&]+/.test(u)) {
    return {
      src: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(u)}&show_text=true&width=500`,
      ratio: 'auto',
      height: 500,
    };
  }
  return null;
}
