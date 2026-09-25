'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cross-device content library (ideas / templates / projects) — the web half.
 * The web app keeps these in localStorage; the mobile app in AsyncStorage;
 * both converge through the `library_items` table (mobile mirrors this file
 * in src/utils/librarySync.ts). One row per (workspace, client_id):
 * last write wins by updated_at, deletes are tombstones.
 */

export type LibraryKind = 'idea' | 'template' | 'project';

export interface LibraryRow {
  client_id: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
}

export function stampOf(data: Record<string, unknown> | null | undefined): number {
  const t = Number((data as { _updatedAt?: unknown } | null)?._updatedAt);
  return Number.isFinite(t) && t > 0 ? t : 0;
}

function withEnvelope(data: Record<string, unknown>): Record<string, unknown> {
  // Creation origin sticks forever — a re-push by the other device must not
  // flip the badge or the last-write-wins comparison.
  const origin = (data as { _origin?: unknown })._origin === 'mobile' ? 'mobile' : 'web';
  return { ...data, _origin: origin, _updatedAt: Math.max(stampOf(data), Date.now()) };
}

/** Push one item (upsert by client_id). Never throws. */
export async function pushLibraryItem(
  sb: SupabaseClient,
  workspaceId: string,
  kind: LibraryKind,
  id: string,
  title: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await sb.from('library_items').upsert(
      {
        workspace_id: workspaceId,
        client_id: id,
        kind,
        title: title ?? '',
        data: withEnvelope(data),
      },
      { onConflict: 'workspace_id,client_id' },
    );
    if (error) console.log('[library] push failed:', error.message);
  } catch (e) {
    console.log('[library] push failed:', e instanceof Error ? e.message : e);
  }
}

/** Tombstone one item so the deletion propagates. Never throws. */
export async function tombstoneLibraryItem(
  sb: SupabaseClient,
  workspaceId: string,
  kind: LibraryKind,
  id: string,
): Promise<void> {
  try {
    const { error } = await sb.from('library_items').upsert(
      {
        workspace_id: workspaceId,
        client_id: id,
        kind,
        title: '',
        data: { _origin: 'web' as const },
        deleted_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,client_id' },
    );
    if (error) console.log('[library] tombstone failed:', error.message);
  } catch (e) {
    console.log('[library] tombstone failed:', e instanceof Error ? e.message : e);
  }
}

/** All cloud rows for this workspace. Null on failure. */
export async function pullLibraryRows(
  sb: SupabaseClient,
  workspaceId: string,
): Promise<LibraryRow[] | null> {
  try {
    const { data, error } = await sb
      .from('library_items')
      .select('client_id, kind, title, data, updated_at, deleted_at')
      .eq('workspace_id', workspaceId);
    if (error) {
      console.log('[library] pull failed:', error.message);
      return null;
    }
    return (data ?? []) as LibraryRow[];
  } catch (e) {
    console.log('[library] pull failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
