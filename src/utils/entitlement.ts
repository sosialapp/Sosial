import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, currentSession } from './supabase';
import { limitsFor, type PlanKey } from './plans';

/**
 * Server-authoritative entitlement for the active workspace.
 *
 * The plan follows the workspace OWNER and lives in the database
 * (public.workspace_entitlement → public.workspace_plan → public.owner_plan).
 * The device only ever holds a cache of the last answer, never the truth, so a
 * stale or hand-edited local plan cannot unlock anything: every write still
 * passes the DB limit triggers.
 *
 * Offline / signed out falls back to Free.
 */

export interface EntitlementLimits {
  channels: number | null;
  scheduledPostsPerChannel: number | null;
  aiCredits: number | null;
  users: number | null;
  workspaces: number | null;
  storageBytes: number | null;
  watermarkRequired: boolean;
}

export interface Entitlement {
  plan: PlanKey;
  limits: EntitlementLimits;
}

const KEY = 'sosial_entitlement_v1';

let cached: Entitlement | null = null;

/** Fallback used while signed out, offline, or before the first fetch. */
export function freeEntitlement(): Entitlement {
  return { plan: 'free', limits: { ...limitsFor('free') } };
}

function isEntitlement(v: unknown): v is Entitlement {
  const e = v as Entitlement | null;
  return !!e && typeof e.plan === 'string' && !!e.limits && typeof e.limits === 'object';
}

/** Memory, then disk cache; Free when nothing is stored yet. */
export async function loadCachedEntitlement(): Promise<Entitlement> {
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (isEntitlement(parsed)) {
      cached = parsed;
      return parsed;
    }
  } catch {}
  return freeEntitlement();
}

/** Fetch the active workspace's plan + limits; null when signed out/offline. */
export async function refreshEntitlement(): Promise<Entitlement | null> {
  try {
    const session = await currentSession().catch(() => null);
    if (!session) return null;
    const { data, error } = await supabase().rpc('workspace_entitlement', {
      p_workspace_id: session.workspace.id,
    });
    if (error || !isEntitlement(data)) return null;
    const ent: Entitlement = { plan: data.plan, limits: data.limits };
    cached = ent;
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(ent));
    } catch {}
    return ent;
  } catch {
    return null;
  }
}

/** Cached entitlement immediately; refresh kicked off in the background. */
export async function loadEntitlement(): Promise<Entitlement> {
  const cur = await loadCachedEntitlement();
  void refreshEntitlement();
  return cur;
}

/** Shared channel-pool snapshot for the active workspace: the cap counts one
 *  pool across every team its OWNER runs (p84 trigger, p85 RPC), so the
 *  Connect screen shows "16 / 25 across your teams" and pre-flights that
 *  number instead of this workspace's local count. */
export async function channelPool(): Promise<{ cap: number | null; used: number } | null> {
  try {
    const session = await currentSession().catch(() => null);
    if (!session) return null;
    const { data, error } = await supabase().rpc('channel_pool', {
      p_workspace_id: session.workspace.id,
    });
    const v = data as { cap?: unknown; used?: unknown } | null;
    if (error || !v || typeof v.used !== 'number') return null;
    const cap = typeof v.cap === 'number' ? v.cap : null;
    return { cap, used: v.used };
  } catch {
    return null;
  }
}
