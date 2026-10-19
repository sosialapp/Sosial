import { supabase, currentSession } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cross-device content library (ideas / templates / projects).
 *
 * The mobile app keeps these in AsyncStorage and the web app in localStorage;
 * this module is the cloud bridge both sides share (web mirrors it in
 * apps/web/src/lib/librarySync.ts). One row per (workspace, client_id):
 * last write wins by updated_at, deletes are tombstones so a removal on one
 * device is never resurrected by the other side's next push.
 *
 * Payloads are the stores' own JSON untouched (plus _origin/_updatedAt
 * envelope fields). Device-local file:// media URIs ride along harmlessly -
 * they simply don't resolve on the other device; remote http(s) media works
 * everywhere.
 */

export type LibraryKind = 'idea' | 'template' | 'project';

export interface LibraryRow {
  client_id: string;
  kind: string;
  title: string;
  data: Record<string, any>;
  updated_at: string;
  deleted_at: string | null;
}

interface SyncCtx {
  wsId: string;
}

async function ctx(): Promise<SyncCtx | null> {
  try {
    const session = await currentSession().catch(() => null);
    if (!session) return null;
    return { wsId: session.workspace.id };
  } catch {
    return null;
  }
}

export function stampOf(data: any): number {
  const t = Number(data?._updatedAt);
  return Number.isFinite(t) && t > 0 ? t : 0;
}

function withEnvelope(data: Record<string, any>): Record<string, any> {
  // Creation origin sticks forever, a re-push by the other device must not
  // flip the badge or the last-write-wins comparison.
  const origin = data?._origin === 'web' ? 'web' : 'mobile';
  return { ...data, _origin: origin, _updatedAt: Math.max(stampOf(data), Date.now()) };
}

/** Push one item (upsert by client_id). Never throws, callers fire-and-forget. */
export async function pushLibraryItem(
  kind: LibraryKind,
  id: string,
  title: string,
  data: Record<string, any>,
): Promise<void> {
  try {
    const c = await ctx();
    if (!c) return;
    const { error } = await supabase()
      .from('library_items')
      .upsert(
        {
          workspace_id: c.wsId,
          client_id: id,
          kind,
          title: title ?? '',
          data: withEnvelope(data),
        },
        { onConflict: 'workspace_id,client_id' },
      );
    if (error) console.log('[library] push failed:', error.message);
  } catch (e: any) {
    console.log('[library] push failed:', e?.message ?? e);
  }
}

/** Tombstone one item so the deletion propagates. Never throws. */
export async function tombstoneLibraryItem(kind: LibraryKind, id: string): Promise<void> {
  try {
    const c = await ctx();
    if (!c) return;
    const { error } = await supabase()
      .from('library_items')
      .upsert(
        {
          workspace_id: c.wsId,
          client_id: id,
          kind,
          title: '',
          data: { _origin: 'mobile' as const },
          deleted_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,client_id' },
      );
    if (error) console.log('[library] tombstone failed:', error.message);
  } catch (e: any) {
    console.log('[library] tombstone failed:', e?.message ?? e);
  }
}

/**
 * Local delete tombstones, keyed `kind:id`. A deletion performed while signed
 * out (or one whose cloud tombstone never landed) otherwise gets resurrected
 * by the next `pullLibraryRows`: the cloud row is still live, the local copy
 * is gone, so the sync re-adds it. Honoured by the idea/template syncs and
 * cleared once the cloud row is confirmed deleted.
 */
const TOMBSTONE_KEY = 'sosial_library_tombstones_v1';

export function tombstoneKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

export async function loadLibraryTombstones(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(TOMBSTONE_KEY);
    const obj: unknown = raw ? JSON.parse(raw) : {};
    if (obj && typeof obj === 'object') {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (typeof v === 'number') out[k] = v;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

export async function markLibraryDeleted(kind: LibraryKind, id: string): Promise<void> {
  if (!id) return;
  try {
    const cur = await loadLibraryTombstones();
    cur[tombstoneKey(kind, id)] = Date.now();
    const trimmed: Record<string, number> = {};
    for (const k of Object.keys(cur).slice(-500)) trimmed[k] = cur[k];
    await AsyncStorage.setItem(TOMBSTONE_KEY, JSON.stringify(trimmed));
  } catch {}
}

export async function clearLibraryDeleted(kind: LibraryKind, id: string): Promise<void> {
  try {
    const key = tombstoneKey(kind, id);
    const cur = await loadLibraryTombstones();
    if (key in cur) {
      delete cur[key];
      await AsyncStorage.setItem(TOMBSTONE_KEY, JSON.stringify(cur));
    }
  } catch {}
}

/** All cloud rows for this workspace. Null when signed out or on failure. */
export async function pullLibraryRows(): Promise<LibraryRow[] | null> {
  try {
    const c = await ctx();
    if (!c) return null;
    const { data, error } = await supabase()
      .from('library_items')
      .select('client_id, kind, title, data, updated_at, deleted_at')
      .eq('workspace_id', c.wsId);
    if (error) {
      console.log('[library] pull failed:', error.message);
      return null;
    }
    return (data ?? []) as LibraryRow[];
  } catch (e: any) {
    console.log('[library] pull failed:', e?.message ?? e);
    return null;
  }
}
