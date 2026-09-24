/**
 * AI picture helpers — shared by the composer picture panel. Two modes:
 * - prompt: Pollinations Flux renders the description (free, no key, same
 *   engine the mobile cover graphics use).
 * - auto: the find-images edge function returns real topical photos from
 *   Wikimedia Commons for the idea's keywords.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** AI-rendered cover graphic (Pollinations Flux, no key, hotlinkable). */
export function aiImageUrl(prompt: string, seed: number): string {
  const desc = prompt.trim().replace(/\s+/g, ' ').slice(0, 200) || 'abstract shapes';
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(desc)}?width=1080&height=1350&seed=${seed}&model=flux&nologo=true`;
}

export const randomSeed = (): number => Math.floor(Math.random() * 1000000);

export interface FoundImage {
  title: string;
  thumb: string;
  url: string;
  width: number;
  height: number;
}

/** Real photos for a topic via the find-images edge function. */
export async function findImages(sb: SupabaseClient, topic: string): Promise<FoundImage[]> {
  const { data, error } = await sb.functions.invoke('find-images', { body: { topic } });
  if (error) throw new Error(error.message);
  const payload = data as { images?: FoundImage[]; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.images?.length) throw new Error('No photos found for that topic — try different words.');
  return payload.images;
}

/**
 * AI-rework one photo from a prompt via the remix-image edge function.
 * Returns a data: URL — attach it exactly like a picked photo.
 */
export async function remixImage(sb: SupabaseClient, imageUrl: string, prompt: string): Promise<string> {
  const { data, error } = await sb.functions.invoke('remix-image', {
    body: { image_url: imageUrl, prompt },
  });
  if (error) throw new Error(error.message);
  const payload = data as { image?: string; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.image) throw new Error('The AI returned nothing — try a different change.');
  return payload.image;
}

/** Download a remote picture into a File so the composer can upload it. */
export async function pictureToFile(url: string, name = 'ai-picture.jpg'): Promise<File> {
  const blob = await (await fetch(url)).blob();
  const type = blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  return new File([blob], name, { type });
}
