/**
 * Picture-canvas templates, web edition of the mobile design library:
 * a spec (size + backdrop + copy) renders as a live HTML miniature and
 * exports a full-res PNG that attaches straight into the composer.
 */

export interface CanvasBg {
  id: string;
  name: string;
  from: string;
  to: string;
  /** dark text on light backdrops */
  ink?: boolean;
}

export interface CanvasSize {
  id: string;
  label: string;
  ratio: number; // height / width
}

export interface CanvasDesign {
  id: string;
  name: string;
  sizeId: string;
  bgId: string;
  title: string;
  body: string;
  handle: string;
  createdAt: number;
  builtIn?: boolean;
}

export const CANVAS_SIZES: CanvasSize[] = [
  { id: 'square', label: '1:1', ratio: 1 },
  { id: 'portrait', label: '4:5', ratio: 1.25 },
  { id: 'story', label: '9:16', ratio: 16 / 9 },
];

export const CANVAS_BGS: CanvasBg[] = [
  { id: 'ember', name: 'Ember', from: '#f26a1b', to: '#7c2d12' },
  { id: 'night', name: 'Night', from: '#26262c', to: '#0d0d11' },
  { id: 'berry', name: 'Berry', from: '#d6249f', to: '#5b0f45' },
  { id: 'ocean', name: 'Ocean', from: '#1d7fe0', to: '#0b3a6b' },
  { id: 'leaf', name: 'Leaf', from: '#2f8f5b', to: '#0e3d26' },
  { id: 'bone', name: 'Bone', from: '#f7f2e7', to: '#e3dac5', ink: true },
];

export const sizeOf = (d: CanvasDesign): CanvasSize =>
  CANVAS_SIZES.find((s) => s.id === d.sizeId) ?? CANVAS_SIZES[0];

export const bgOf = (d: CanvasDesign): CanvasBg =>
  CANVAS_BGS.find((b) => b.id === d.bgId) ?? CANVAS_BGS[0];

export const STARTER_DESIGNS: CanvasDesign[] = [
  {
    id: 'design-launch',
    name: 'Launch card',
    sizeId: 'portrait',
    bgId: 'ember',
    title: 'It’s live.',
    body: 'Everything you asked for, in one place. Tap the link to explore.',
    handle: '@yourhandle',
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'design-quote',
    name: 'Quote card',
    sizeId: 'square',
    bgId: 'night',
    title: '“Show up every day.”',
    body: 'Consistency beats intensity — the algorithm rewards both.',
    handle: '@yourhandle',
    createdAt: 0,
    builtIn: true,
  },
  {
    id: 'design-promo',
    name: 'Promo card',
    sizeId: 'story',
    bgId: 'berry',
    title: '20% off ends Sunday',
    body: 'One weekend only. No code needed — discount applies at checkout.',
    handle: '@yourhandle',
    createdAt: 0,
    builtIn: true,
  },
];

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push('');
      continue;
    }
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(t).width > maxWidth) {
        out.push(line);
        line = w;
      } else {
        line = t;
      }
    }
    out.push(line);
  }
  return out;
}

/** Render the design at full post resolution (1080 wide) → PNG blob. */
export async function exportDesignPng(d: CanvasDesign): Promise<Blob> {
  const W = 1080;
  const H = Math.round(W * sizeOf(d).ratio);
  const bg = bgOf(d);
  const ink = bg.ink ? '#191512' : '#ffffff';
  const sub = bg.ink ? 'rgba(25,21,18,0.72)' : 'rgba(255,255,255,0.82)';

  try {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('800 100px "Plus Jakarta Sans"'),
      document.fonts.load('300 60px "Inter"'),
    ]).catch(() => []);
  } catch {
    /* system fonts it is */
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');

  const grad = ctx.createLinearGradient(0, 0, W * 0.3, H);
  grad.addColorStop(0, bg.from);
  grad.addColorStop(1, bg.to);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const pad = 110;
  const maxW = W - pad * 2;
  let y = H * 0.3;

  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  if (d.title.trim()) {
    ctx.font = '800 96px "Plus Jakarta Sans", system-ui, sans-serif';
    const lines = wrapLines(ctx, d.title.trim(), maxW).slice(0, 4);
    for (const line of lines) {
      y += 112;
      ctx.fillText(line, pad, y);
    }
    y += 30;
  }
  if (d.body.trim()) {
    ctx.font = '300 52px "Inter", system-ui, sans-serif';
    ctx.fillStyle = sub;
    const lines = wrapLines(ctx, d.body.trim(), maxW).slice(0, 8);
    for (const line of lines) {
      y += 70;
      if (y > H - 200) break;
      ctx.fillText(line, pad, y);
    }
  }

  // Footer: accent dot + handle, pinned near the bottom.
  const handle = d.handle.trim() || '@yourhandle';
  ctx.font = '500 44px "Inter", system-ui, sans-serif';
  ctx.fillStyle = sub;
  const dotR = 12;
  const dotX = pad;
  const baseY = H - 120;
  ctx.beginPath();
  ctx.arc(dotX + dotR, baseY - 14, dotR, 0, Math.PI * 2);
  ctx.fillStyle = bg.ink ? '#c8500f' : '#f5b98a';
  ctx.fill();
  ctx.fillStyle = sub;
  ctx.fillText(handle, dotX + dotR * 2 + 18, baseY);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Export failed — try again.');
  return blob;
}
