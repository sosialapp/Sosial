import 'server-only';
import sharp from 'sharp';
import { BOLT_PNG_BASE64 } from './watermarkAsset';

/**
 * Server-side watermark compositing.
 *
 * The client never receives an un-watermarked file when the watermark is
 * required: it posts the rendered PNG to /api/export/watermark and only the
 * composited result comes back. There is no font dependency — the mark is the
 * Sosial bolt inside a translucent rounded badge, drawn with vectors + the
 * embedded logo, so it renders identically on any host.
 */

const boltLogo = Buffer.from(BOLT_PNG_BASE64, 'base64');

export async function applyWatermark(png: Buffer): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const W = meta.width ?? 1080;
  const H = meta.height ?? 1080;

  // Badge scales with the image, clamped so tiny exports stay legible and
  // large ones don't dominate.
  const badge = Math.max(
    44,
    Math.min(Math.round(W * 0.1), 220, Math.round(W * 0.34), Math.round(H * 0.34)),
  );
  const pad = Math.max(10, Math.round(W * 0.035));
  const radius = Math.round(badge * 0.3);
  const inset = Math.round(badge * 0.19);
  const left = W - badge - pad;
  const top = H - badge - pad;

  const pillSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${badge}" height="${badge}">` +
      `<rect x="0.5" y="0.5" width="${badge - 1}" height="${badge - 1}" rx="${radius}" ` +
      `fill="rgba(0,0,0,0.42)" stroke="rgba(255,255,255,0.22)" stroke-width="1"/></svg>`,
  );
  const logo = await sharp(boltLogo)
    .resize(badge - inset * 2, badge - inset * 2, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp(png)
    .composite([
      { input: pillSvg, left, top },
      { input: logo, left: left + inset, top: top + inset },
    ])
    .png()
    .toBuffer();
}
