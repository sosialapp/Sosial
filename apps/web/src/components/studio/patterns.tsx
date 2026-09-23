/**
 * Pattern engine — direct port of mobile PatternBackground math to web SVG.
 * All sizes in canvas units; the caller scales via width/height + viewBox.
 * Every layer receives `scale` (render width / 340) so pattern density and
 * stroke weight look identical at preview size and at 1080px export.
 */

import type { BackgroundStyle, BgType } from '@/lib/studio/model';

function grid(width: number, height: number, step: number) {
  const cols = Math.max(1, Math.ceil(width / step));
  const rows = Math.max(1, Math.ceil(height / step));
  const ox = (width - (cols - 1) * step) / 2;
  const oy = (height - (rows - 1) * step) / 2;
  return { cols, rows, ox, oy };
}

function rowY(height: number, step: number) {
  const rows = Math.max(2, Math.ceil(height / step) + 1);
  const first = (height - (rows - 1) * step) / 2;
  return { rows, first };
}

/** Solid plain heart — single bezier path, no emoji. s = half width. */
function heartPath(cx: number, cy: number, s: number): string {
  return (
    `M${cx} ${cy + s * 0.95} ` +
    `C${cx - s * 1.5} ${cy - s * 0.05} ${cx - s * 0.9} ${cy - s * 1.15} ${cx} ${cy - s * 0.32} ` +
    `C${cx + s * 0.9} ${cy - s * 1.15} ${cx + s * 1.5} ${cy - s * 0.05} ${cx} ${cy + s * 0.95} Z`
  );
}

export function PatternLayer({
  type,
  color,
  size,
  opacity,
  width,
  height,
  scale = 1,
}: {
  type: BgType;
  color: string;
  size: number;
  opacity: number;
  width: number;
  height: number;
  /** Render scale (width / 340) — keeps stroke weight and density faithful. */
  scale?: number;
}) {
  if (type === 'solid') return null;
  const s = size * scale;

  if (type === 'dots') {
    const { cols, rows, ox, oy } = grid(width, height, s);
    const els = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++)
        els.push(<circle key={`${i}-${j}`} cx={ox + i * s} cy={oy + j * s} r={Math.max(1.5, s * 0.09)} fill={color} opacity={opacity} />);
    return <>{els}</>;
  }
  if (type === 'grid') {
    const { cols, rows, ox, oy } = grid(width, height, s);
    const els = [];
    for (let i = 0; i < cols; i++) {
      const x = ox + i * s;
      els.push(<line key={`v${i}`} x1={x} y1={0} x2={x} y2={height} stroke={color} strokeWidth={Math.max(1, 1 * scale)} opacity={opacity} />);
    }
    for (let j = 0; j < rows; j++) {
      const y = oy + j * s;
      els.push(<line key={`h${j}`} x1={0} y1={y} x2={width} y2={y} stroke={color} strokeWidth={Math.max(1, 1 * scale)} opacity={opacity} />);
    }
    return <>{els}</>;
  }
  if (type === 'stripes') {
    const { cols, ox } = grid(width, height, s);
    const els = [];
    for (let i = -Math.ceil(height / s) - 1; i < cols + Math.ceil(height / s) + 1; i++) {
      const x = ox + i * s;
      els.push(<line key={i} x1={x} y1={0} x2={x + height} y2={height} stroke={color} strokeWidth={s * 0.35} opacity={opacity} />);
    }
    return <>{els}</>;
  }
  if (type === 'zigzag') {
    // Independent zigzag rows spanning past both edges — full coverage, clean peaks.
    const amp = s * 0.35;
    const half = s * 0.5;
    const rowH = s * 0.8;
    const rows = Math.ceil(height / rowH) + 2;
    const sw = Math.max(1.5, 2 * scale);
    const els = [];
    for (let r = 0; r < rows; r++) {
      const y = r * rowH;
      let d = `M${-half} ${y + amp} `;
      let k = 0;
      for (let x = -half; x <= width + half; x += half, k++) {
        d += `L${x + half} ${y + (k % 2 === 0 ? -amp : amp) + amp} `;
      }
      els.push(<path key={r} d={d} stroke={color} strokeWidth={sw} fill="none" opacity={opacity} strokeLinejoin="miter" strokeLinecap="square" />);
    }
    return <>{els}</>;
  }
  if (type === 'waves') {
    const amp = s * 0.28;
    const step = s * 0.5;
    const { rows, first } = rowY(height, s * 0.9);
    let d = '';
    for (let r = 0; r < rows; r++) {
      const y = first + r * s * 0.9;
      d += `M0 ${y} `;
      let k = 0;
      for (let x = 0; x < width; x += step, k++) {
        d += `Q${x + step / 2} ${y + (k % 2 === 0 ? -amp : amp)} ${x + step} ${y} `;
      }
    }
    return <path d={d} stroke={color} strokeWidth={Math.max(1.5, 2 * scale)} fill="none" opacity={opacity} />;
  }
  if (type === 'hearts') {
    const { cols, rows, ox, oy } = grid(width, height, s);
    const half = s * 0.2;
    const els = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const cx = ox + i * s;
        const cy = oy + j * s + half * 0.3;
        els.push(<path key={`${i}-${j}`} d={heartPath(cx, cy, half)} fill={color} opacity={opacity} />);
      }
    return <>{els}</>;
  }
  if (type === 'stars') {
    const { cols, rows, ox, oy } = grid(width, height, s);
    const h = s * 0.24;
    const k = h * 0.18;
    const els = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = ox + i * s;
        const y = oy + j * s;
        els.push(
          <path
            key={`${i}-${j}`}
            d={`M${x} ${y - h} Q${x + k} ${y - k} ${x + h} ${y} Q${x + k} ${y + k} ${x} ${y + h} Q${x - k} ${y + k} ${x - h} ${y} Q${x - k} ${y - k} ${x} ${y - h} Z`}
            fill={color}
            opacity={opacity}
          />,
        );
      }
    return <>{els}</>;
  }
  if (type === 'crosses') {
    const { cols, rows, ox, oy } = grid(width, height, s);
    const l = s * 0.16;
    const sw = Math.max(1.5, s * 0.07);
    const els = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = ox + i * s;
        const y = oy + j * s;
        els.push(<line key={`v${i}-${j}`} x1={x} y1={y - l} x2={x} y2={y + l} stroke={color} strokeWidth={sw} opacity={opacity} />);
        els.push(<line key={`h${i}-${j}`} x1={x - l} y1={y} x2={x + l} y2={y} stroke={color} strokeWidth={sw} opacity={opacity} />);
      }
    return <>{els}</>;
  }
  if (type === 'doodle') {
    const { cols, rows, ox, oy } = grid(width, height, s);
    const els = [];
    let n = 0;
    const sw = Math.max(1.2, 1.5 * scale);
    for (let jy = 0; jy < rows; jy++)
      for (let jx = 0; jx < cols; jx++) {
        const hsh = (jx * 31 + jy * 57) % 4;
        const cx = ox + jx * s + (((jx * 13 + jy * 7) % 9) - 4) * s * 0.03;
        const cy = oy + jy * s + (((jx * 5 + jy * 17) % 9) - 4) * s * 0.03;
        const m = s * 0.13;
        if (hsh === 0) {
          els.push(<circle key={n++} cx={cx} cy={cy} r={m} stroke={color} strokeWidth={sw} fill="none" opacity={opacity} />);
        } else if (hsh === 1) {
          els.push(
            <g key={n++} stroke={color} strokeWidth={sw} opacity={opacity}>
              <line x1={cx - m} y1={cy - m} x2={cx + m} y2={cy + m} />
              <line x1={cx + m} y1={cy - m} x2={cx - m} y2={cy + m} />
            </g>,
          );
        } else if (hsh === 2) {
          els.push(
            <path key={n++} d={`M${cx - m} ${cy} Q${cx - m / 2} ${cy - m} ${cx} ${cy} Q${cx + m / 2} ${cy + m} ${cx + m} ${cy}`} stroke={color} strokeWidth={sw} fill="none" opacity={opacity} />,
          );
        } else {
          els.push(<circle key={n++} cx={cx} cy={cy} r={m * 0.45} fill={color} opacity={opacity} />);
        }
      }
    return <>{els}</>;
  }
  return null;
}

/** Full backdrop: base + optional photo + pattern (+ dotted whisper on photos) + mix + dim. */
export function PatternBackground({ bg, width, height }: { bg: BackgroundStyle; width: number; height: number }) {
  const scale = width / 340;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ width, height, backgroundColor: bg.color }}>
      {bg.type === 'image' && bg.imageUri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bg.imageUri}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 1 - (bg.imageOpacity ?? 0.35) }}
        />
      ) : null}
      <svg width={width} height={height} className="absolute inset-0">
        {bg.type !== 'image' || !bg.imageUri ? (
          <PatternLayer type={bg.type} color={bg.patternColor} size={bg.patternSize} opacity={bg.patternOpacity} width={width} height={height} scale={scale} />
        ) : (
          <PatternLayer type="dots" color={bg.patternColor} size={bg.patternSize} opacity={bg.patternOpacity * 0.6} width={width} height={height} scale={scale} />
        )}
        {bg.mixEnabled && bg.mixType ? (
          <PatternLayer type={bg.mixType} color={bg.mixColor ?? '#4D7CFE'} size={Math.max(10, bg.patternSize * 1.4)} opacity={bg.mixOpacity ?? 0.12} width={width} height={height} scale={scale} />
        ) : null}
      </svg>
      {bg.type === 'image' && bg.imageUri ? (
        <div className="absolute inset-0" style={{ backgroundColor: bg.color, opacity: bg.imageOpacity ?? 0.35 }} />
      ) : null}
    </div>
  );
}

/** patternOpacity has no mobile stepper — fixed sensible default with a slider in our editor. */
export const DEFAULT_PATTERN_OPACITY = 0.5;
