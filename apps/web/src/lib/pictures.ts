/**
 * AI picture helpers — shared by the composer picture panel. Generation runs
 * on the server-side OpenAI key (gpt-image-1); the client crops the render to
 * the exact chosen ratio. Real photos come from the web via copy/paste.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type PictureRatio = '1:1' | '4:5' | '9:16' | '3:2' | '16:9';

export const PICTURE_RATIOS: { id: PictureRatio; label: string }[] = [
  { id: '1:1', label: 'Square' },
  { id: '4:5', label: 'Portrait' },
  { id: '9:16', label: 'Story' },
  { id: '3:2', label: 'Landscape' },
  { id: '16:9', label: 'Wide' },
];

/** Center-crop a data: URL to an exact w:h ratio via canvas. */
async function cropToRatio(dataUrl: string, ratio: string): Promise<string> {
  const [wStr, hStr] = ratio.split(':');
  const target = Number(wStr) / Number(hStr);
  if (!Number.isFinite(target) || target <= 0) return dataUrl;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('crop failed'));
    el.src = dataUrl;
  });
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  if (Math.abs(srcW / srcH - target) < 0.01) return dataUrl;
  const cropW = srcW / srcH > target ? Math.round(srcH * target) : srcW;
  const cropH = srcW / srcH > target ? srcH : Math.round(srcW / target);
  const canvas = document.createElement('canvas');
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, Math.round((srcW - cropW) / 2), Math.round((srcH - cropH) / 2), cropW, cropH, 0, 0, cropW, cropH);
  return canvas.toDataURL('image/png');
}

/** AI-rendered picture from a text prompt, cropped to the chosen ratio. */
export async function generateImage(sb: SupabaseClient, prompt: string, ratio: PictureRatio = '4:5'): Promise<string> {
  const { data, error } = await sb.functions.invoke('generate-image', { body: { prompt, ratio } });
  if (error) throw new Error(error.message);
  const payload = data as { image?: string; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.image) throw new Error('The AI returned nothing — try a different description.');
  try {
    return await cropToRatio(payload.image, ratio);
  } catch {
    return payload.image;
  }
}

/** Download a remote picture into a File so the composer can upload it. */
export async function pictureToFile(url: string, name = 'ai-picture.jpg'): Promise<File> {
  const blob = await (await fetch(url)).blob();
  const type = blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  return new File([blob], name, { type });
}
