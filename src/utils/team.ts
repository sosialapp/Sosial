import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCIAL_META, uid } from '../constants';
import {
  type ConnectedAccount,
  type ProviderKey,
  accountAvatar,
  accountName,
  connectedAccounts,
  findAccount,
  findAccountForProvider,
} from './socialAccounts';

export type TeamRole = 'owner' | 'admin' | 'member';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  /** account ids the member may post to, or ['all'] for every account */
  channels: string[];
  createdAt: number;
}

/** Who is acting in the Team screen. Owner is the device holder (account email). */
export interface Actor {
  id: string | null;
  role: TeamRole;
}

const KEY = 'zap_team_v1';

/** Local roster for now — invites/sync need the backend; roles are enforced once sync lands. */
export async function loadTeam(): Promise<TeamMember[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: TeamMember[] = raw ? JSON.parse(raw) : [];
    return list.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

async function persist(list: TeamMember[]): Promise<TeamMember[]> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  return list;
}

export async function addTeamMember(m: { name: string; email: string; channels: string[] }): Promise<TeamMember[]> {
  const list = await loadTeam();
  const rec: TeamMember = {
    id: uid('member'),
    name: m.name.trim() || 'Teammate',
    email: m.email.trim(),
    role: 'member',
    channels: m.channels.length ? m.channels : ['all'],
    createdAt: Date.now(),
  };
  list.push(rec);
  return persist(list);
}

export async function updateMember(id: string, patch: Partial<Pick<TeamMember, 'name' | 'email' | 'role' | 'channels'>>): Promise<TeamMember[]> {
  const list = await loadTeam();
  return persist(list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
}

export async function removeTeamMember(id: string): Promise<TeamMember[]> {
  const list = await loadTeam();
  return persist(list.filter((x) => x.id !== id));
}

/** Persist a full, already-built roster (used for one-shot migrations). */
export async function saveTeam(list: TeamMember[]): Promise<TeamMember[]> {
  return persist(list);
}

/* ---------------- permissions (mirrored by the backend later) ---------------- */

/** Owner removes anyone; admin removes members only (never self, never admins). */
export function canRemoveMember(actor: Actor, target: TeamMember): boolean {
  if (actor.role === 'owner') return target.role !== 'owner';
  if (actor.role === 'admin') return target.role === 'member' && target.id !== actor.id;
  return false;
}

/** Owner assigns anyone; admin assigns members only. */
export function canAssignChannels(actor: Actor, target: TeamMember): boolean {
  if (actor.role === 'owner') return true;
  if (actor.role === 'admin') return target.role === 'member' && target.id !== actor.id;
  return false;
}

/** Only the owner moves people between admin and member (never creates owners). */
export function canChangeRole(actor: Actor, target: TeamMember, next: 'admin' | 'member'): boolean {
  if (actor.role !== 'owner') return false;
  return target.role !== 'owner' && target.role !== next;
}

/** Owner or admin can approve/reject a post waiting for approval. */
export function canApprove(actor: Actor): boolean {
  return actor.role === 'owner' || actor.role === 'admin';
}

/** Members submit their drafts for approval before they queue. */
export function canSubmit(actor: Actor): boolean {
  return actor.role === 'member';
}

/* ---------------- persisted "acting as" (who you are on this device) ---------------- */

const ACTOR_KEY = 'zap_acting_as_v1';

/** Current actor: persisted member id, or the owner (device holder) when unset. */
export async function loadActor(): Promise<Actor> {
  try {
    const id = await AsyncStorage.getItem(ACTOR_KEY);
    if (!id) return { id: null, role: 'owner' };
    const m = (await loadTeam()).find((x) => x.id === id);
    return m ? { id: m.id, role: m.role } : { id: null, role: 'owner' };
  } catch {
    return { id: null, role: 'owner' };
  }
}

/** Persist who is acting on this device (null = owner) and return the resolved actor. */
export async function saveActor(id: string | null): Promise<Actor> {
  try {
    if (id) await AsyncStorage.setItem(ACTOR_KEY, id);
    else await AsyncStorage.removeItem(ACTOR_KEY);
  } catch {}
  return loadActor();
}

/** 'All channels' or 'Facebook +2' style label, resolving account ids to names. */
export function memberChannelsLabel(ids: string[], accounts: ConnectedAccount[] = []): string {
  if (ids.includes('all')) return 'All channels';
  const names = ids.map((id) => {
    const a = findAccount(accounts, id);
    if (a) return accountName(a) ?? SOCIAL_META[a.provider]?.label ?? id;
    return SOCIAL_META[id]?.label ?? id;
  });
  if (names.length === 0) return 'No channels';
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

/** One assignable entry per connected account (account-level scoping). */
export interface AssignableChannel {
  id: string;
  provider: ProviderKey;
  label: string;
  sub: string;
  avatar?: string;
}

/** Every connected account, grouped by provider order (stable). */
export function assignableChannels(accounts: ConnectedAccount[]): AssignableChannel[] {
  const connected = connectedAccounts(accounts);
  const order = Object.keys(SOCIAL_META);
  const byProvider = new Map<ProviderKey, ConnectedAccount[]>();
  for (const a of connected) {
    const list = byProvider.get(a.provider) ?? [];
    list.push(a);
    byProvider.set(a.provider, list);
  }
  const providers = Array.from(byProvider.keys()).sort(
    (a, b) => order.indexOf(a) - order.indexOf(b),
  );
  const out: AssignableChannel[] = [];
  for (const p of providers) {
    for (const a of byProvider.get(p)!) {
      out.push({
        id: a.id,
        provider: p,
        label: accountName(a) ?? SOCIAL_META[p]?.label ?? p,
        sub: SOCIAL_META[p]?.label ?? p,
        avatar: accountAvatar(a),
      });
    }
  }
  return out;
}

/** Migrate a legacy provider-key channel list to account ids in place. */
export function normalizeChannels(ids: string[], accounts: ConnectedAccount[]): string[] {
  if (ids.includes('all')) return ['all'];
  return ids.map((id) => {
    if (findAccount(accounts, id)) return id;
    const a = findAccountForProvider(accounts, id as ProviderKey);
    return a?.id ?? id;
  });
}
