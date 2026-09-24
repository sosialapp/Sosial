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
  'ig-heart': <g transform="translate(1 2.2) scale(0.043)" stroke="currentColor" strokeWidth={2.5}><path d="M463.044 117.283c-10.125-26.729-28.412-47.537-50.269-60.578-13.478-8.048-28.343-13.125-43.461-14.808-14.879-1.655-30.018.007-44.284 5.407-37.461 14.189-50.601 41.912-66.522 74.028-3.422 6.887-1.964 6.964-5.893.078-17.576-30.87-33.786-63.684-70.127-75.725-12.879-4.26-26.554-5.408-40.088-3.845-13.83 1.606-27.546 6.028-40.207 12.83-25.068 13.485-45.883 36.215-55.382 64.916-31.525 95.237 83.379 188.376 170.42 258.918 12.97 10.506 25.363 20.547 36.834 30.251 15.449-13.288 32.356-26.695 49.995-40.687 87.815-69.634 195.291-154.872 158.984-250.785zm-29.173-95.842c29.483 17.589 54.094 45.531 67.663 81.351 46.924 123.973-73.479 219.471-171.871 297.485-22.829 18.11-44.418 35.228-61.078 50.41-7.626 7.478-19.85 7.894-27.969.711-13.9-12.323-31.033-26.201-49.312-41.01C94.743 332.128-32.73 228.808 7.688 106.7c12.956-39.151 41.144-70.042 75.028-88.266C99.939 9.175 118.705 3.147 137.724.943c19.337-2.232 38.983-.556 57.65 5.619 22.047 7.302 42.601 20.751 59.55 41.271 16.316-18.527 35.37-31.35 55.614-39.018 20.513-7.759 42.13-10.168 63.283-7.816 20.913 2.324 41.453 9.337 60.05 20.442z" fill="currentColor" fillRule="nonzero" /></g>,
  'ig-comment': <g transform="translate(1 1) scale(0.1789)"><path d="M61.44,0a61.46,61.46,0,0,1,54.91,89l6.44,25.74a5.83,5.83,0,0,1-7.25,7L91.62,115A61.43,61.43,0,1,1,61.44,0ZM96.63,26.25a49.78,49.78,0,1,0-9,77.52A5.83,5.83,0,0,1,92.4,103L109,107.77l-4.5-18a5.86,5.86,0,0,1,.51-4.34,49.06,49.06,0,0,0,4.62-11.58,50,50,0,0,0-13-47.62Z" fill="currentColor" stroke="none" /></g>,
  'ig-plane': <g transform="translate(1 2.3) scale(0.179)"><path d="M96.14,12.47l-76.71-1.1,28.3,27.85L96.14,12.47ZM53.27,49l9.88,39.17L102.1,22,53.27,49ZM117,1.6a5.59,5.59,0,0,1,4.9,8.75L66.06,105.21a5.6,5.6,0,0,1-10.44-1.15L41.74,49,1.67,9.57A5.59,5.59,0,0,1,5.65,0L117,1.6Z" fill="currentColor" stroke="none" /></g>,
  repost: <><path d="m2 9 3-3 3 3" /><path d="M13 18H7a2 2 0 0 1-2-2V6" /><path d="m22 15-3 3-3-3" /><path d="M11 6h6a2 2 0 0 1 2 2v10" /></>,
  'x-comment': <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />,
  'x-retweet': <g transform="scale(1.1429)"><path d="m13.5 13.5 3 3 3-3" /><path d="M9.5 4.5h3a4 4 0 0 1 4 4v8m-9-9-3-3-3 3" /><path d="M11.5 16.5h-3a4 4 0 0 1-4-4v-8" /></g>,
  'x-views': <path d="M4 9v11M8 4v16m4-9v9m4-13v13m4-6v6" />,
  'x-bookmark': <g transform="translate(1.5 1.5) scale(0.041)"><path d="M352 48H160a48 48 0 0 0-48 48v368l144-128 144 128V96a48 48 0 0 0-48-48" fill="currentColor" stroke="none" /></g>,
  'x-share': <g transform="translate(1 4.2) scale(0.8)"><path d="M22 18.5a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0M18.5 20a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3M9 11.5a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0M5.5 13a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3M22 5.5a3.5 3.5 0 1 0-7 0a3.5 3.5 0 0 0 7 0M18.5 4a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3" fill="currentColor" stroke="none" fillRule="evenodd" /><path d="M16.617 18.065a1 1 0 0 0-.388-1.36l-8.243-4.58a1 1 0 0 0-.972 1.75l8.244 4.579a1 1 0 0 0 1.36-.389Zm.115-12.168a1 1 0 0 1-.508 1.32l-8.318 3.697a1 1 0 0 1-.812-1.828l8.318-3.697a1 1 0 0 1 1.32.508" fill="currentColor" stroke="none" fillRule="evenodd" /></g>,
  'th-repost': <><path d="M8 18.5H12.5C15.7875 18.5 17.4312 18.5 18.5376 17.592C18.7401 17.4258 18.9258 17.2401 19.092 17.0376C20 15.9312 20 14.2875 20 11M16 5.5H11.5C8.21252 5.5 6.56878 5.5 5.46243 6.40796C5.25989 6.57418 5.07418 6.75989 4.90796 6.96243C4 8.06878 4 9.71252 4 13" /><path d="M13.5 2C13.5 2 17 4.57771 17 5.50003C17 6.42234 13.5 9 13.5 9" /><path d="M10.5 15C10.5 15 7.00001 17.5777 7 18.5C6.99999 19.4223 10.5 22 10.5 22" /></>,
  'th-send': <><path d="M22 12L3 20l3.563-8L3 4z" /><path d="M6.5 12H22" /></>,
  'ig-repost': <><path d="M8 18.5H12.5C15.7875 18.5 17.4312 18.5 18.5376 17.592C18.7401 17.4258 18.9258 17.2401 19.092 17.0376C20 15.9312 20 14.2875 20 11M16 5.5H11.5C8.21252 5.5 6.56878 5.5 5.46243 6.40796C5.25989 6.57418 5.07418 6.75989 4.90796 6.96243C4 8.06878 4 9.71252 4 13" /><path d="M13.5 2C13.5 2 17 4.57771 17 5.50003C17 6.42234 13.5 9 13.5 9" /><path d="M10.5 15C10.5 15 7.00001 17.5777 7 18.5C6.99999 19.4223 10.5 22 10.5 22" /></>,
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
