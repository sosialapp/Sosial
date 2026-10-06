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

  // Text pill scales with the image, clamped for legibility.
  const fs = Math.max(16, Math.min(Math.round(W * 0.028), 44));
  const pad = Math.max(10, Math.round(W * 0.035));
  const bolt = fs;
  const text = 'Made with sosial.app';
  const approxW = Math.round(fs * 9.6 + bolt * 1.35);
  const pillH = Math.round(fs * 2.1);
  const pillW = approxW;
  const left = W - pillW - pad;
  const top = H - pillH - pad;

  const pillSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pillW}" height="${pillH}">` +
      `<text x="${bolt + fs * 0.35}" y="${pillH * 0.72}" font-family="Helvetica, Arial, sans-serif" ` +
      `font-size="${fs}" fill="rgba(255,255,255,0.92)">Made with <tspan font-weight="bold">sosial.app</tspan></text></svg>`,
  );
  const logo = await sharp(boltLogo)
    .resize(bolt, bolt, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp(png, { failOn: 'none' })
    .composite([
      { input: logo, left: left + Math.round(fs * 0.15), top: top + Math.round((pillH - bolt) / 2) },
      { input: pillSvg, left, top },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
