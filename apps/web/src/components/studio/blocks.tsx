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
  'ig-heart': <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />,
  'ig-comment': <g transform="translate(24 0) scale(-1 1)"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" /></g>,
  'ig-plane': <><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21 21-5-5" /></>,
  repost: <><path d="m2 9 3-3 3 3" /><path d="M13 18H7a2 2 0 0 1-2-2V6" /><path d="m22 15-3 3-3-3" /><path d="M11 6h6a2 2 0 0 1 2 2v10" /></>,
  'ig-bookmark': <path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" />,
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
