import AsyncStorage from '@react-native-async-storage/async-storage';
import { uid } from '../constants';
import { pushLibraryItem, tombstoneLibraryItem, pullLibraryRows } from './librarySync';

/** One chain segment: text plus optional per-post photos/videos.
 *  Posting carries every segment's media into the composer, where chain
 *  channels publish each reply with its own attachment(s). */
export interface ThreadSeg {
  text: string;
  media: { uri: string; kind: 'image' | 'video' }[];
}

/** A content idea: social-style title + description + optional image/video.
 *  Tapping "Design" spins up a design-studio project linked via designProjectId.
 *  `thread` holds an optional chain of segments when the idea is long-form. */
export interface Idea {
  id: string;
  title: string;
  body: string;
  imageUri?: string;
  videoUri?: string;
  thread?: ThreadSeg[];
  designProjectId?: string;
  createdAt: number;
  /** last-write-wins clock for cross-device sync (ms). */
  updatedAt?: number;
}

/** Legacy ideas stored `thread` as bare strings — normalize on load so old
 *  chains keep working next to the new media-carrying segments. */
function normThread(t: unknown): ThreadSeg[] | undefined {
  if (!Array.isArray(t) || t.length === 0) return undefined;
  if (typeof t[0] === 'string') return (t as string[]).map((s) => ({ text: s, media: [] }));
  // Multi-attach stores an array; older records stored one object per segment.
  return (t as any[]).map((s) => ({
    text: String(s?.text ?? ''),
    media: Array.isArray(s?.media) ? s.media : s?.media ? [s.media] : [],
  }));
}

const KEY = 'zap_ideas_v1';

export async function loadIdeas(): Promise<Idea[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: Idea[] = raw ? JSON.parse(raw) : [];
    for (const idea of list) idea.thread = normThread(idea.thread);
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function saveIdea(p: Partial<Idea> & { title: string }): Promise<Idea[]> {
  const list = await loadIdeas();
  const rec: Idea = {
    id: p.id || uid('idea'),
    title: p.title,
    body: p.body ?? '',
    imageUri: p.imageUri,
    videoUri: p.videoUri,
    thread: p.thread && p.thread.length > 0 ? p.thread : undefined,
    designProjectId: p.designProjectId,
    createdAt: p.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
  const i = list.findIndex((x) => x.id === rec.id);
  if (i >= 0) list[i] = rec;
  else list.unshift(rec);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  void pushLibraryItem('idea', rec.id, rec.title, rec as unknown as Record<string, unknown>);
  return list;
}

export async function deleteIdea(id: string): Promise<Idea[]> {
  const list = await loadIdeas();
  const next = list.filter((x) => x.id !== id);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  void tombstoneLibraryItem('idea', id);
  return next;
}

/**
 * Two-way sync with the cloud library. Web ideas arrive as plain title/body
 * (same shape both sides); tombstones remove local copies deleted elsewhere.
 * Returns the merged list.
 */
export async function syncIdeas(): Promise<Idea[]> {
  const rows = await pullLibraryRows().catch(() => null);
  if (!rows) return loadIdeas();
  const list = await loadIdeas();
  const byId = new Map(list.map((x) => [x.id, x]));
  const cloudById = new Map<string, (typeof rows)[number]>();
  let dirty = false;

  for (const r of rows) {
    if (r.kind !== 'idea') continue;
    cloudById.set(r.client_id, r);
    const local = byId.get(r.client_id);
    const localTs = local ? (local.updatedAt ?? local.createdAt ?? 0) : -1;
    if (r.deleted_at) {
      if (local && localTs < Date.parse(r.deleted_at)) {
        byId.delete(r.client_id);
        dirty = true;
      }
      continue;
    }
    const cloudTs = Date.parse(r.updated_at) || 0;
    if (!local || cloudTs > localTs) {
      const d = (r.data ?? {}) as Record<string, unknown>;
      const str = (v: unknown): string | undefined =>
        typeof v === 'string' && v.length > 0 ? v : undefined;
      // Portable media only: blob: URLs die with the session that made them,
      // file:// URIs never resolve on another device.
      const portable = (v: unknown): string | undefined => {
        const s = str(v);
        return s && /^(https?:|data:image\/|data:video\/)/.test(s) ? s : undefined;
      };
      let imageUri = portable(d.imageUri);
      let videoUri = portable(d.videoUri);
      if (Array.isArray(d.media)) {
        for (const part of d.media as unknown[]) {
          if (!Array.isArray(part)) continue;
          for (const m of part as unknown[]) {
            const url = (m as { url?: unknown })?.url;
            const kind = (m as { kind?: unknown })?.kind === 'video' ? 'video' : 'image';
            const ok = portable(url);
            if (ok && kind === 'image' && !imageUri) imageUri = ok;
            if (ok && kind === 'video' && !videoUri) videoUri = ok;
          }
        }
      }
      const rec: Idea = {
        id: r.client_id,
        title: str(d.title) ?? (r.title || 'Untitled'),
        body: str(d.body) ?? '',
        imageUri,
        videoUri,
        thread: normThread(d.thread),
        designProjectId: str(d.designProjectId),
        createdAt: Number(d.createdAt) || Date.now(),
        updatedAt: cloudTs || Date.now(),
      };
      byId.set(r.client_id, rec);
      dirty = true;
    }
  }
  // Push locals the cloud is missing or behind on.
  for (const local of byId.values()) {
    const cloud = cloudById.get(local.id);
    const localTs = local.updatedAt ?? local.createdAt ?? 0;
    if (!cloud || (cloud.deleted_at == null && (Date.parse(cloud.updated_at) || 0) < localTs)) {
      void pushLibraryItem('idea', local.id, local.title, local as unknown as Record<string, unknown>);
    }
  }
  if (!dirty) return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  const next = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}
