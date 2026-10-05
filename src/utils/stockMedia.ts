/**
 * Stock search client (Pexels + Unsplash) via edge functions — keys never
 * touch the device. Unsplash attribution is appended by the caller at attach
 * time (see attachStockItem), never here, so no path can skip it.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { callEdgeFunction } from './supabase';

export interface StockItem {
  id: string;
  kind: 'image' | 'video';
  thumb: string;
  full: string;
  width: number;
  height: number;
  author: string;
  authorUrl: string;
  source: 'pexels' | 'unsplash';
}

export async function searchStock(
  source: 'pexels' | 'unsplash',
  query: string,
  type: 'photo' | 'video' = 'photo',
  page = 1,
): Promise<StockItem[]> {
  const fn = source === 'pexels' ? 'pexels-search' : 'unsplash-search';
  const j: any = await callEdgeFunction(fn, { query, type, page, per_page: 12 });
  if (j?.error) throw new Error(String(j.error));
  const items = Array.isArray(j?.items) ? j.items : [];
  return items.map((x: any) => ({ ...x, source }));
}

/** Unsplash license credit line — auto-appended to captions, non-optional.
 *  Format matches Unsplash's own attribution example. */
export function unsplashCredit(item: StockItem): string {
  return `Photo by ${item.author} on Unsplash (${item.authorUrl})`;
}

/** Unsplash production requirement: firing a download event when a photo is
 *  used. Fire-and-forget — the attach never waits on it. */
async function trackUnsplashDownload(id: string): Promise<void> {
  try {
    await callEdgeFunction('unsplash-download', { id });
  } catch {}
}

/**
 * Download a stock item into the app sandbox and return a composer-ready
 * attachment (same shape as the camera roll produces).
 */
export async function downloadStockItem(item: StockItem): Promise<{ uri: string; kind: 'image' | 'video' }> {
  if (item.source === 'unsplash') void trackUnsplashDownload(item.id);
  const ext = item.kind === 'video' ? 'mp4' : 'jpg';
  const dest = `${FileSystem.documentDirectory}stock/${item.source}_${item.id}.${ext}`;
  try {
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}stock/`, { intermediates: true });
  } catch {}
  const dl = await FileSystem.downloadAsync(item.full, dest);
  if (dl.status !== 200) throw new Error('Stock download failed — try another one.');
  return { uri: dl.uri, kind: item.kind };
}
