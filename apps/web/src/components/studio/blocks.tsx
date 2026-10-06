/**
 * StudioCanvas — DOM port of mobile PostCanvas (+ ContentBlockView +
 * SocialCardChrome). All-inline styles so the export serializer captures
 * the exact tree. Unit system: canvas units, design width 340 (k = width/340).
 */
import { BrandIcon } from '@/components/BrandIcon';
import {
  DATA,
  FONT_STACKS,
  type CardStyle,
  type ContentBlock,
  type FontId,
  type PostPage,
} from '@/lib/studio/model';
import { PatternBackground } from './patterns';

/* ------------------------------- helpers ------------------------------- */

function ff(font: FontId | undefined, bold = false, italic = false): React.CSSProperties {
  return {
    fontFamily: FONT_STACKS[font ?? 'inter'],
    fontWeight: bold ? 700 : 400,
    fontStyle: italic ? 'italic' : 'normal',
  };
}

function hexLum(hex: string): number {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isDarkHex(hex: string): boolean {
  return hexLum(hex || '#ffffff') < 0.45;
}

function contrastRatio(a: string, b: string): number {
  const l1 = hexLum(a);
  const l2 = hexLum(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* --------------------------- chrome icon set --------------------------- */

/** Scalloped verified seal (check laid over it by the caller in white). */
export const VERIFIED_SEAL =
  'M22.02 11.164a1.84 1.84 0 0 0-.57-.67l-1.33-1a.35.35 0 0 1-.14-.2a.36.36 0 0 1 0-.25l.55-1.63a2 2 0 0 0 .06-.9a1.8 1.8 0 0 0-.36-.84a1.86 1.86 0 0 0-.7-.57a1.75 1.75 0 0 0-.85-.17h-1.5a.41.41 0 0 1-.39-.3l-.43-1.5a1.9 1.9 0 0 0-.46-.81a2 2 0 0 0-.78-.49a2 2 0 0 0-.92-.06a1.9 1.9 0 0 0-.83.39l-1.14.9a.35.35 0 0 1-.23.09a.36.36 0 0 1-.22-.05l-1.13-.9a1.85 1.85 0 0 0-.8-.38a1.9 1.9 0 0 0-.88 0a1.9 1.9 0 0 0-.78.43a2.1 2.1 0 0 0-.51.79l-.43 1.51a.38.38 0 0 1-.15.22a.4.4 0 0 1-.27.07H5.41a1.9 1.9 0 0 0-.89.18a1.8 1.8 0 0 0-.71.57a1.9 1.9 0 0 0-.36.83c-.05.293-.03.595.06.88L4 8.993a.41.41 0 0 1-.14.45l-1.33 1c-.242.18-.44.412-.58.68a1.93 1.93 0 0 0 0 1.71a2 2 0 0 0 .58.68l1.33 1a.41.41 0 0 1 .14.45l-.55 1.63a2 2 0 0 0-.07.91c.05.298.174.58.36.82c.183.25.428.45.71.58c.265.126.557.184.85.17h1.49a.38.38 0 0 1 .25.08a.34.34 0 0 1 .14.21l.43 1.51a2 2 0 0 0 .46.8a1.89 1.89 0 0 0 2.54.17l1.15-.91a.39.39 0 0 1 .49 0l1.13.9c.24.202.53.337.84.39q.17.015.34 0a1.9 1.9 0 0 0 .58-.09a1.87 1.87 0 0 0 1.24-1.28l.44-1.52a.34.34 0 0 1 .14-.21a.4.4 0 0 1 .27-.08h1.43a2 2 0 0 0 .89-.17a1.91 1.91 0 0 0 1.06-1.4a1.9 1.9 0 0 0-.07-.92l-.54-1.62a.36.36 0 0 1 0-.25a.35.35 0 0 1 .14-.2l1.33-1a1.9 1.9 0 0 0 .57-.68a1.8 1.8 0 0 0 .21-.86a1.9 1.9 0 0 0-.23-.78';

const ICON_PATHS: Record<string, React.ReactNode> = {
  heart: <path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.8 4 2.1C12.9 5.8 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.7-3.5 6.9-8.5 10.9Z" />,
  'heart-fill': <path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.8 4 2.1C12.9 5.8 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.7-3.5 6.9-8.5 10.9Z" fill="currentColor" stroke="none" />,
  comment: <path d="M4 6.5A3.5 3.5 0 0 1 7.5 3h9A3.5 3.5 0 0 1 20 6.5v6a3.5 3.5 0 0 1-3.5 3.5H9l-5 4V6.5Z" />,
  send: <path d="M20 4 11 13M20 4l-6.5 16-2.5-6.5L4.5 11 20 4Z" />,
  bookmark: <path d="M7 4h10v16l-5-3.5L7 20V4Z" />,
  repeat: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  star: <path d="m12 4 2.3 4.9 5.2.6-3.9 3.6 1 5.2-4.6-2.6-4.6 2.6 1-5.2L4.5 9.5l5.2-.6L12 4Z" />,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.3 2.3 3.5 5.2 3.5 8.5s-1.2 6.2-3.5 8.5c-2.3-2.3-3.5-5.2-3.5-8.5S9.7 5.8 12 3.5Z" /></>,
  dots: <><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
  'dots-v': <><circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" /></>,
  like: <path d="M7 10.5V20H4.5A1.5 1.5 0 0 1 3 18.5v-6.5A1.5 1.5 0 0 1 4.5 10.5H7Zm0 0 4-7c1.4 0 2.2 1.2 1.9 2.6L12.5 9H19a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17.7 19H7" />,
  /* Custom action set — uniform 24 box; odd-grid glyphs scale inside. */
  'fb-like': <path d="M7 10v12m8-16.12L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88" />,
  'fb-comment': <g transform="translate(24 0) scale(-1 1)"><path d="m3 20 1.3-3.9A9 8 0 1 1 7.7 19z" /></g>,
  'fb-share': <path d="M13 4v4C6.425 9.028 3.98 14.788 3 20c-.037.206 5.384-5.962 10-6v4l8-7z" />,
  /* Instagram outline glyphs (user-supplied art, 20-unit boxes) — bookmark
     stays as-is. Stroke inherits currentColor via ChromeIcon. */
  /* Instagram outline glyphs — normalized to the bookmark's footprint
     (~19.7/24 grid units, 2.15 margin) so all five icons read as one set.
     Stroke width scaled to match the bookmark's visual weight at size. */
  'ig-heart': <g transform="scale(1.16)"><path d="M10.5167 17.3417C10.2334 17.4417 9.76669 17.4417 9.48335 17.3417C7.06669 16.5167 1.66669 13.075 1.66669 7.24166C1.66669 4.66666 3.74169 2.58333 6.30002 2.58333C7.81669 2.58333 9.15835 3.31666 10 4.45C10.4282 3.87156 10.9858 3.40143 11.6283 3.07728C12.2709 2.75313 12.9804 2.58396 13.7 2.58333C16.2584 2.58333 18.3334 4.66666 18.3334 7.24166C18.3334 13.075 12.9334 16.5167 10.5167 17.3417Z" fill="none" strokeWidth={1.42} /></g>,
  'ig-comment': <g transform="scale(1.16)"><path d="M41 17.5C39.5166 17.5 38.0666 17.0601 36.8332 16.236C35.5999 15.4119 34.6386 14.2406 34.0709 12.8701C33.5032 11.4997 33.3547 9.99168 33.6441 8.53683C33.9335 7.08197 34.6478 5.7456 35.6967 4.6967C36.7456 3.64781 38.082 2.9335 39.5368 2.64411C40.9917 2.35472 42.4997 2.50325 43.8701 3.07091C45.2406 3.63856 46.4119 4.59986 47.236 5.83323C48.0601 7.0666 48.5 8.51664 48.5 10C48.5 11.24 48.2 12.4083 47.6667 13.4392L48.5 17.5L44.4392 16.6667C43.4092 17.1992 42.2392 17.5 41 17.5Z" fill="none" strokeWidth={1.42} transform="translate(-30.7 -0.3)" /></g>,
  'ig-plane': <g transform="scale(1.16)"><path d="M101.077 10.8214L108.274 7.5M100.817 4.31416L108.274 4.25755C111.621 4.23214 112.726 6.41369 110.746 9.10883L106.317 15.1088C103.341 19.145 100.868 18.3415 100.833 13.3268L100.816 11.1133L99.0348 9.79858C94.9987 6.82234 95.7995 4.35752 100.817 4.31416Z" fill="none" strokeWidth={1.42} transform="translate(-96.4 -0.7)" /></g>,
  'ig-repost': <g transform="scale(1.16)">
    <path d="M74.0167 4.29999H67.5C66.1167 4.29999 65 5.41665 65 6.79999V11" fill="none" strokeWidth={1.42} transform="translate(-63.3 -0.9)" />
    <path d="M72.6333 7.01667L75.2667 4.38333L72.6333 1.75" fill="none" strokeWidth={1.42} transform="translate(-63.3 -0.9)" />
    <path d="M70.2333 15.7H76.75C78.1333 15.7 79.25 14.5834 79.25 13.2V9" fill="none" strokeWidth={1.42} transform="translate(-63.3 -0.9)" />
    <path d="M71.6167 12.9833L68.9833 15.6167L71.6167 18.25" fill="none" strokeWidth={1.42} transform="translate(-63.3 -0.9)" />
  </g>,
  repost: <><path d="m2 9 3-3 3 3" /><path d="M13 18H7a2 2 0 0 1-2-2V6" /><path d="m22 15-3 3-3-3" /><path d="M11 6h6a2 2 0 0 1 2 2v10" /></>,
  'x-comment': <g transform="translate(1 1.55) scale(1.1)"><path d="M0 7.64406C0 3.42072 3.42454 0 7.64884 0H11.8206C16.1108 0 19.5879 3.47805 19.5879 7.76827C19.5879 10.5966 18.0524 13.1956 15.5786 14.5619L7.88294 18.8235V15.2977H7.81892C3.52869 15.3932 0 11.9438 0 7.64406ZM7.64884 1.91101C4.47942 1.91101 1.91101 4.48133 1.91101 7.64406C1.91101 10.8641 4.55777 13.4535 7.77592 13.3867L8.1113 13.3771H9.79395V15.5748L14.6546 12.8898C16.5188 11.8578 17.6769 9.89906 17.6769 7.76827C17.6769 4.5291 15.055 1.91101 11.8206 1.91101H7.64884Z" fill="currentColor" stroke="none" /></g>,
  'x-retweet': <g transform="scale(1.1429)"><path d="m13.5 13.5 3 3 3-3" /><path d="M9.5 4.5h3a4 4 0 0 1 4 4v8m-9-9-3-3-3 3" /><path d="M11.5 16.5h-3a4 4 0 0 1-4-4v-8" /></g>,
  'x-views': <path d="M4 9v11M8 4v16m4-9v9m4-13v13m4-6v6" />,
  'x-bookmark': <g transform="translate(1.5 1.5) scale(0.041)"><path d="M352 48H160a48 48 0 0 0-48 48v368l144-128 144 128V96a48 48 0 0 0-48-48" fill="currentColor" stroke="none" /></g>,
  'x-share': <g transform="translate(1 4.2) scale(0.8)"><path d="M22 18.5a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0M18.5 20a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3M9 11.5a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0M5.5 13a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3M22 5.5a3.5 3.5 0 1 0-7 0a3.5 3.5 0 0 0 7 0M18.5 4a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3" fill="currentColor" stroke="none" fillRule="evenodd" /><path d="M16.617 18.065a1 1 0 0 0-.388-1.36l-8.243-4.58a1 1 0 0 0-.972 1.75l8.244 4.579a1 1 0 0 0 1.36-.389Zm.115-12.168a1 1 0 0 1-.508 1.32l-8.318 3.697a1 1 0 0 1-.812-1.828l8.318-3.697a1 1 0 0 1 1.32.508" fill="currentColor" stroke="none" fillRule="evenodd" /></g>,
  'bsky-comment': <g transform="translate(-1.401 -2.77) scale(0.042)"><path d="m267.7 576.9-37.8 26.7c-7.3 5.2-16.9 5.8-24.9 1.7S192 593 192 584v-72h-32c-53 0-96-43-96-96V192c0-53 43-96 96-96h320c53 0 96 43 96 96v224c0 53-43 96-96 96H359.6zM332 472.8c8.1-5.7 17.8-8.8 27.7-8.8H480c26.5 0 48-21.5 48-48V192c0-26.5-21.5-48-48-48H160c-26.5 0-48 21.5-48 48v224c0 26.5 21.5 48 48 48h56c10.4 0 19.3 6.6 22.6 15.9c.9 2.5 1.4 5.2 1.4 8.1v49.7c32.7-23.1 63.3-44.7 91.9-64.9z" fill="currentColor" stroke="none" /></g>,
  'bsky-repost': <g transform="translate(-0.542 -0.542) scale(1.194)"><path d="m13.5 13.5 3 3 3-3" /><path d="M9.5 4.5h3a4 4 0 0 1 4 4v8m-9-9-3-3-3 3" /><path d="M11.5 16.5h-3a4 4 0 0 1-4-4v-8" /></g>,
  'bsky-heart': <g transform="translate(-2.252 -2.278) scale(0.056)"><path d="M352.92 80C288 80 256 144 256 144s-32-64-96.92-64c-52.76 0-94.54 44.14-95.08 96.81c-1.1 109.33 86.73 187.08 183 252.42a16 16 0 0 0 18 0c96.26-65.34 184.09-143.09 183-252.42c-.54-52.67-42.32-96.81-95.08-96.81" fill="currentColor" stroke="none" /></g>,
  'bsky-bookmark': <g transform="translate(-1.714 -2.178) scale(1.143)"><path d="M5 6.09A3.09 3.09 0 0 1 8.09 3h7.82A3.09 3.09 0 0 1 19 6.09v13.697c0 1.336-1.597 2.024-2.568 1.107L12 16.71l-4.432 4.185c-.97.918-2.568.229-2.568-1.107V6.091ZM8.09 5A1.09 1.09 0 0 0 7 6.09v12.59l3.954-3.735a1.523 1.523 0 0 1 2.091 0L17 18.68V6.09A1.09 1.09 0 0 0 15.91 5z" fill="currentColor" stroke="none" /></g>,
  'bsky-share': <g transform="translate(1.25 1.25) scale(0.018)"><path d="M754.553 35.03v294.208C487.317 329.246 0 332.178 0 1164.97c55.25-556.9 309.061-560.402 754.553-560.408v321.292L1200 480.407z" fill="currentColor" stroke="none" /></g>,
  /* Threads outline glyphs (user-supplied art, 20-unit boxes) — filled
     crescents stay filled, brackets stay stroked; stroke inherits
     currentColor via ChromeIcon. */
  'th-heart': <g transform="translate(2 2)"><path d="M10.5167 17.3417C10.2334 17.4417 9.76669 17.4417 9.48335 17.3417C7.06669 16.5167 1.66669 13.075 1.66669 7.24166C1.66669 4.66666 3.74169 2.58333 6.30002 2.58333C7.81669 2.58333 9.15835 3.31666 10 4.45C10.4282 3.87156 10.9858 3.40143 11.6283 3.07728C12.2709 2.75313 12.9804 2.58396 13.7 2.58333C16.2584 2.58333 18.3334 4.66666 18.3334 7.24166C18.3334 13.075 12.9334 16.5167 10.5167 17.3417Z" fill="none" strokeWidth={1.5} /></g>,
  'th-comment': <g transform="translate(-30 2)"><path d="M41 17.5C39.5166 17.5 38.0666 17.0601 36.8332 16.236C35.5999 15.4119 34.6386 14.2406 34.0709 12.8701C33.5032 11.4997 33.3547 9.99168 33.6441 8.53683C33.9335 7.08197 34.6478 5.7456 35.6967 4.6967C36.7456 3.64781 38.082 2.9335 39.5368 2.64411C40.9917 2.35472 42.4997 2.50325 43.8701 3.07091C45.2406 3.63856 46.4119 4.59986 47.236 5.83323C48.0601 7.0666 48.5 8.51664 48.5 10C48.5 11.24 48.2 12.4083 47.6667 13.4392L48.5 17.5L44.4392 16.6667C43.4092 17.1992 42.2392 17.5 41 17.5Z" fill="none" strokeWidth={1.5} /></g>,
  'th-repost': <g transform="translate(-60 2.1)">
    <path d="M79.1776 7.70637C79.3125 8.09802 79.7393 8.30619 80.1309 8.17134C80.5226 8.03648 80.7308 7.60967 80.5959 7.21802L79.8868 7.4622L79.1776 7.70637ZM64.9765 7.42151L65.6843 7.66955C66.041 6.65182 66.6235 5.72807 67.3881 4.9676L66.8592 4.43582L66.3303 3.90405C65.4051 4.82423 64.7003 5.94199 64.2687 7.17347L64.9765 7.42151ZM66.8592 4.43582L67.3881 4.9676C68.1527 4.20713 69.0796 3.62968 70.0993 3.27858L69.8551 2.56944L69.611 1.8603C68.3771 2.28514 67.2556 2.98386 66.3303 3.90405L66.8592 4.43582ZM69.8551 2.56944L70.0993 3.27858C71.8903 2.66188 73.853 2.78192 75.5555 3.6123L75.8843 2.9382L76.213 2.26411C74.153 1.25934 71.7781 1.11409 69.611 1.8603L69.8551 2.56944ZM75.8843 2.9382L75.5555 3.6123C77.258 4.44267 78.5609 5.91535 79.1776 7.70637L79.8868 7.4622L80.5959 7.21802C79.8497 5.05085 78.2731 3.26887 76.213 2.26411L75.8843 2.9382Z" fill="currentColor" stroke="none" />
    <path d="M64.2687 12.8742C64.1317 12.4833 64.3376 12.0554 64.7285 11.9184C65.1194 11.7814 65.5473 11.9873 65.6843 12.3782L64.9765 12.6262L64.2687 12.8742ZM64.9765 12.6262L65.6843 12.3782C66.041 13.3959 66.6235 14.3196 67.3881 15.0801L66.8592 15.6119L66.3303 16.1437C65.4051 15.2235 64.7003 14.1057 64.2687 12.8742L64.9765 12.6262ZM66.8592 15.6119L67.3881 15.0801C68.1527 15.8406 69.0796 16.418 70.0993 16.7691L69.8551 17.4783L69.611 18.1874C68.3771 17.7626 67.2556 17.0639 66.3303 16.1437L66.8592 15.6119ZM69.8551 17.4783L70.0993 16.7691C71.8903 17.3858 73.853 17.2658 75.5555 16.4354L75.8843 17.1095L76.213 17.7836C74.153 18.7884 71.7781 18.9336 69.611 18.1874L69.8551 17.4783ZM75.8843 17.1095L75.5555 16.4354C77.258 15.605 78.5609 14.1324 79.1776 12.3413L79.8868 12.5855L80.5959 12.8297C79.8497 14.9969 78.2731 16.7788 76.213 17.7836L75.8843 17.1095Z" fill="currentColor" stroke="none" />
    <path d="M63.8621 3.99999V7.72409H67.5862" fill="none" strokeWidth={1.5} />
    <path d="M80.9167 15.5144L80.6569 11.7994L76.9419 12.0592" fill="none" strokeWidth={1.5} />
  </g>,
  'th-send': <g transform="translate(-92 2.2)"><path d="M98.9136 9.85948L110.549 10.0009M101.636 3.94336L108.306 7.27854C111.3 8.77525 111.294 11.2207 108.306 12.7233L101.636 16.0585C97.1518 18.3035 95.3133 16.465 97.5584 11.9808L98.5483 10.0009L97.5584 8.021C95.3133 3.53677 97.1459 1.70418 101.636 3.94336Z" fill="none" strokeWidth={1.5} /></g>,
  'ig-bookmark': <g transform="translate(2.14 1) scale(0.043)"><path d="M32.256 0h394.488c8.895 0 16.963 3.629 22.795 9.462C455.371 15.294 459 23.394 459 32.256v455.929c0 13.074-10.611 23.685-23.686 23.685-7.022 0-13.341-3.07-17.683-7.93L230.124 330.422 39.692 505.576c-9.599 8.838-24.56 8.214-33.398-1.385a23.513 23.513 0 01-6.237-16.006L0 32.256C0 23.459 3.629 15.391 9.461 9.55l.089-.088C15.415 3.621 23.467 0 32.256 0zm379.373 47.371H47.371v386.914l166.746-153.364c8.992-8.198 22.933-8.319 32.013.089l165.499 153.146V47.371z" fill="currentColor" stroke="none" fillRule="nonzero" /></g>,
  chat: <path d="M4 6.5A3.5 3.5 0 0 1 7.5 3h9A3.5 3.5 0 0 1 20 6.5v6a3.5 3.5 0 0 1-3.5 3.5H9l-5 4V6.5Z" />,
  undo: <path d="M8 5 4 9l4 4M4 9h9a7 7 0 0 1 0 14h-2" />,
  redo: <path d="m16 5 4 4-4 4M20 9h-9a7 7 0 0 0 0 14h2" />,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  check: <><circle cx="12" cy="12" r="9" fill="#1D9BF0" stroke="none" /><path d="m8.5 12.2 2.4 2.4 4.6-5" stroke="#fff" strokeWidth={2} /></>,
  ghost: <path d="M12 3C7.5 3 5 6.5 5 10v9l2.6-1.6 2.2 1.6 2.2-1.6 2.2 1.6 2.2-1.6L19 19v-9c0-3.5-2.5-7-7-7ZM9 11.5h.01M15 11.5h.01" />,
};

export function ChromeIcon({ name, size, color }: { name: string; size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color }} aria-hidden="true">
      {ICON_PATHS[name] ?? null}
    </svg>
  );
}

/* -------------------------------- blocks ------------------------------- */

export function BlockView({ block, width, font, zoom = 1 }: { block: ContentBlock; width: number; font: FontId; zoom?: number }) {  const tc = block.textColor ?? '#111111';
  const w = width;
  const k = w / 340;
  const sz = (base: number, f: number) => Math.max(base * k, w * f) * zoom;
  const hair = Math.max(0.5, w / 340);
  const heading = block.heading ? (
    <p style={{ ...ff(font, true), fontSize: sz(12, 0.045), color: tc, margin: `0 0 ${Math.max(4 * k, w * 0.015)}px` }}>{block.heading}</p>
  ) : null;

  if (block.type === 'free') {
    return (
      <div>
        {heading}
        {(block.items ?? []).map((line, i) => (
          <p key={i} style={{ ...ff(font), fontSize: sz(11, 0.038), color: tc, lineHeight: 1.36, margin: 0 }}>{line}</p>
        ))}
      </div>
    );
  }
  if (block.type === 'bullets') {
    return (
      <div>
        {heading}
        {(block.items ?? []).map((line, i) => (
          <div key={i} style={{ display: 'flex', gap: Math.max(6 * k, w * 0.02), marginBottom: Math.max(4 * k, w * 0.015) }}>
            <span style={{ width: Math.max(6 * k, w * 0.02), height: Math.max(6 * k, w * 0.02), borderRadius: Math.max(3 * k, w * 0.01), backgroundColor: tc, marginTop: Math.max(3 * k, w * 0.013), flexShrink: 0 }} />
            <p style={{ ...ff(font), fontSize: sz(11, 0.038), color: tc, flex: 1, lineHeight: 1.36, margin: 0 }}>{line}</p>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === 'numbered') {
    return (
      <div>
        {heading}
        {(block.items ?? []).map((line, i) => (
          <div key={i} style={{ display: 'flex', gap: Math.max(6 * k, w * 0.02), marginBottom: Math.max(4 * k, w * 0.015) }}>
            <span
              style={{
                width: Math.max(16 * k, w * 0.045), height: Math.max(16 * k, w * 0.045),
                borderRadius: Math.max(8 * k, w * 0.02), borderWidth: hair * 1.5, borderStyle: 'solid', borderColor: tc,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
                ...ff(font, true), fontSize: sz(9, 0.028), color: tc,
              }}
            >
              {i + 1}
            </span>
            <p style={{ ...ff(font), fontSize: sz(11, 0.038), color: tc, flex: 1, lineHeight: 1.36, margin: 0 }}>{line}</p>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === 'table') {
    const rows = block.table ?? [['', '']];
    return (
      <div>
        {heading}
        <div style={{ borderWidth: hair, borderStyle: 'solid', borderColor: `${tc}44`, borderRadius: Math.max(6 * k, w * 0.015), overflow: 'hidden' }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', backgroundColor: ri === 0 ? `${tc}14` : 'transparent' }}>
              {row.map((cell, ci) => (
                <p
                  key={ci}
                  style={{ ...ff(font, ri === 0), flex: 1, fontSize: sz(9, 0.028), padding: Math.max(4 * k, w * 0.012), color: tc, margin: 0, borderLeftWidth: ci > 0 ? hair : 0, borderLeftStyle: 'solid', borderLeftColor: `${tc}22` }}
                >
                  {cell}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (block.type === 'image') {
    const asp = block.imageAspect ?? (block.imageH !== undefined ? 'custom' : 'wide');
    const frameH = asp === 'custom' ? (block.imageH ?? 140) * k : asp === 'square' ? w : (w * 9) / 16;
    const focus = block.imageFocus ?? 4;
    const fx = (focus % 3) - 1;
    const fy = Math.floor(focus / 3) - 1;
    return (
      <div>
        {heading}
        {block.imageUri ? (
          <div style={{ width: '100%', height: frameH, overflow: 'hidden', borderRadius: 8 * k, position: 'relative', backgroundColor: '#00000010' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.imageUri}
              alt=""
              style={{
                position: 'absolute', width: fx !== 0 || fy !== 0 ? '140%' : '100%', height: fx !== 0 || fy !== 0 ? '140%' : '100%',
                objectFit: 'cover',
                left: fx === 0 ? '0' : fx > 0 ? 'auto' : '-40%', right: fx > 0 ? '-40%' : 'auto',
                top: fy === 0 ? '0' : fy > 0 ? 'auto' : '-40%', bottom: fy > 0 ? '-40%' : 'auto',
              }}
            />
          </div>
        ) : (
          <div style={{ width: '100%', height: frameH, borderRadius: 8 * k, borderWidth: hair, borderStyle: 'dashed', borderColor: `${tc}66`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ ...ff(font), fontSize: sz(10, 0.03), color: `${tc}99`, margin: 0 }}>No image yet. Pick one in the editor</p>
          </div>
        )}
      </div>
    );
  }
  if (block.type === 'bar' || block.type === 'pie' || block.type === 'vbar') {
    return (
      <div>
        {heading}
        <ChartBlock block={block} w={w} font={font} zoom={zoom} />
      </div>
    );
  }
  return null;
}

export function ChartBlock({ block, w, font, zoom = 1 }: { block: ContentBlock; w: number; font: FontId; zoom?: number }) {
  const k = w / 340;
  const sz = (base: number, f: number) => Math.max(base * k, w * f) * zoom;
  const txt = (base: number) => sz(base, 0.032);
  if (block.type === 'bar') {
    const data = block.chart ?? [];
    const total = data.reduce((a, b) => a + b.value, 0) || 1;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: Math.max(4 * k, w * 0.02) }}>
        {data.map((d, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: Math.max(6 * k, w * 0.02) }}>
              <p style={{ ...ff(font, true), fontSize: txt(8), color: block.textColor ?? '#111', flex: 1, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</p>
              <p style={{ ...ff(font), fontSize: txt(8), color: block.textColor ?? '#111', margin: 0 }}>{d.value}</p>
            </div>
            <div style={{ height: Math.max(6 * k, w * 0.03), backgroundColor: '#00000015', borderRadius: 6 * k, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(0, d.value / total) * 100}%`, height: Math.max(6 * k, w * 0.03), backgroundColor: d.color ?? DATA[i % DATA.length], borderRadius: 6 * k }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === 'pie') {
    const data = block.chart ?? [];
    const total = data.reduce((a, b) => a + Math.max(0, b.value), 0) || 1;
    const R = Math.max(20 * k, w * 0.15);
    const SW = R * 0.35;
    const VB = (R + SW / 2 + 2) * 2;
    const CC = VB / 2;
    const C = 2 * Math.PI * R;
    let acc = 0;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: Math.max(8 * k, w * 0.04) }}>
        <svg width={VB} height={VB} viewBox={`0 0 ${VB} ${VB}`}>
          <circle cx={CC} cy={CC} r={R} stroke="#00000015" strokeWidth={SW} fill="none" />
          {data.map((d, i) => {
            const frac = Math.max(0, d.value) / total;
            const dash = frac * C;
            const off = -acc * C;
            acc += frac;
            return <circle key={i} cx={CC} cy={CC} r={R} stroke={d.color ?? DATA[i % DATA.length]} strokeWidth={SW} fill="none" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={off} transform={`rotate(-90 ${CC} ${CC})`} />;
          })}
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: Math.max(3 * k, w * 0.015) }}>
          {data.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: Math.max(4 * k, w * 0.02) }}>
              <span style={{ width: Math.max(8 * k, w * 0.025), height: Math.max(8 * k, w * 0.025), borderRadius: Math.max(4 * k, w * 0.0125), backgroundColor: d.color ?? DATA[i % DATA.length] }} />
              <p style={{ ...ff(font), fontSize: sz(10, 0.03), color: block.textColor ?? '#111', flex: 1, margin: 0 }}>{d.label}</p>
              <p style={{ ...ff(font, true), fontSize: sz(10, 0.03), color: block.textColor ?? '#111', margin: 0 }}>{Math.round((Math.max(0, d.value) / total) * 100)}%</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // vbar
  const data = block.chart ?? [];
  const total = data.reduce((a, b) => a + Math.max(0, b.value), 0) || 1;
  const maxH = Math.max(80 * k, w * 0.35);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: Math.max(6 * k, w * 0.03) }}>
      {data.map((d, i) => {
        const h = Math.max(2 * k, (Math.max(0, d.value) / total) * maxH);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 * k }}>
            <p style={{ ...ff(font, true), fontSize: txt(8), color: block.textColor ?? '#111', margin: 0 }}>{d.value}</p>
            <div style={{ height: maxH, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
              <div style={{ height: h, width: '100%', backgroundColor: d.color ?? DATA[i % DATA.length], borderRadius: 6 * k }} />
            </div>
            <p style={{ ...ff(font), fontSize: txt(8), color: block.textColor ?? '#111', margin: 0 }}>{d.label}</p>
          </div>
        );
      })}
    </div>
  );
}
