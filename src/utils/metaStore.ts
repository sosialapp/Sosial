import * as SecureStore from 'expo-secure-store';
import { uid } from '../constants';
import {
  type ConnectedAccount,
  type ProviderKey,
  accountsFromMeta,
  metaFromAccounts,
  applyMetaPatch,
  upsertAccount as mergeAccount,
  removeAccount as dropAccount,
} from './socialAccounts';

export interface MetaState {
  fbUserToken?: string;
  pageId?: string;
  pageName?: string;
  pageToken?: string;
  igToken?: string;
  igId?: string;
  igName?: string;
  threadsToken?: string;
  threadsId?: string;
  threadsName?: string;
  // TikTok — access token dies in 24h, so we keep the expiry + refresh token
  // and mint silently via getValidToken() in tiktokAuth.ts
  ttAccessToken?: string;
  ttRefreshToken?: string;
  ttExpiresAt?: number;
  ttOpenId?: string;
  ttName?: string;
  /** last audience that actually published — preferred over the Public default */
  ttLastPrivacy?: string;
  // Verified-domain upload endpoint for TikTok photo posts (TikTok rejects
  // anonymous hosts for photos via url_ownership_unverified).
  ttPhotoHost?: string;
  // X (OAuth 2.0 PKCE) — access token dies in 2h, so we keep the expiry +
  // rotating refresh token and mint silently via getValidXToken() in xAuth.ts
  xAccessToken?: string;
  xRefreshToken?: string;
  xExpiresAt?: number;
  xUserId?: string;
  xName?: string;
  // Bluesky (AT Protocol) — handle + app password, no OAuth. accessJwt lives
  // ~2h; the PDS host is per-account (resolved at login) and every call goes
  // there. Silent refresh via getValidBsky() in bskyAuth.ts.
  bskyAccessJwt?: string;
  bskyRefreshJwt?: string;
  bskyExpiresAt?: number;
  bskyDid?: string;
  bskyHandle?: string;
  bskyName?: string;
  bskyPdsHost?: string;
  // LinkedIn (OAuth 2.0 code flow) — ~60-day access token + rotating refresh.
  // Silent refresh via getValidLi() in liAuth.ts. Posts as the member by
  // default; liOrgId/liOrgName pick a Company Page you admin (org picker in
  // ConnectScreen) — publish + analytics then target the org instead.
  liAccessToken?: string;
  liRefreshToken?: string;
  liExpiresAt?: number;
  liPersonUrn?: string;
  liName?: string;
  liOrgId?: string;
  liOrgName?: string;
  // Mastodon (per-instance OAuth) — access token is long-lived and doesn't
  // expire, so there's no refresh dance; the instance is the account's server.
  mastodonAccessToken?: string;
  mastodonInstance?: string;
  mastodonAccountId?: string;
  mastodonName?: string;
  // Pinterest (OAuth 2.0 code flow, Basic-auth exchange) — ~30-day access
  // token + non-expiring refresh; silent refresh via getValidPin() in
  // pinAuth.ts. Pins must land on a board (pinBoardId, picked after connect).
  pinAccessToken?: string;
  pinRefreshToken?: string;
  pinExpiresAt?: number;
  pinUsername?: string;
  pinBoardId?: string;
  pinBoardName?: string;
  // YouTube (Google OAuth code flow) — 1-hour access token + refresh token.
  // Silent refresh via getValidYt() in ytAuth.ts. Video-only uploads.
  ytAccessToken?: string;
  ytRefreshToken?: string;
  ytExpiresAt?: number;
  ytChannelName?: string;
}

const ACCOUNTS_KEY = 'zap_accounts_v1';
const LEGACY_KEY = 'zap_meta_v1';

async function readAccounts(): Promise<ConnectedAccount[]> {
  try {
    const raw = await SecureStore.getItemAsync(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ConnectedAccount[]) : [];
  } catch {
    return [];
  }
}

async function writeAccounts(accounts: ConnectedAccount[]): Promise<void> {
  try {
    if (accounts.length === 0) await SecureStore.deleteItemAsync(ACCOUNTS_KEY);
    else await SecureStore.setItemAsync(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {}
}

/**
 * Load accounts, migrating the legacy flat zap_meta_v1 on first run after the
 * multi-account upgrade. Migration is one-way and idempotent: once accounts
 * exist (or the legacy key is gone) it short-circuits.
 */
async function ensureMigrated(): Promise<ConnectedAccount[]> {
  const existing = await readAccounts();
  if (existing.length > 0) return existing;
  let legacyRaw: string | null = null;
  try {
    legacyRaw = await SecureStore.getItemAsync(LEGACY_KEY);
  } catch {}
  if (!legacyRaw) return [];
  try {
    const legacy = JSON.parse(legacyRaw) as MetaState;
    const accounts = accountsFromMeta(legacy ?? {});
    await writeAccounts(accounts);
    try {
      await SecureStore.deleteItemAsync(LEGACY_KEY);
    } catch {}
    return accounts;
  } catch {
    return [];
  }
}

export async function loadMetaState(): Promise<MetaState> {
  return metaFromAccounts(await ensureMigrated());
}

export async function saveMetaState(patch: Partial<MetaState>): Promise<MetaState> {
  const accounts = await ensureMigrated();
  const next = applyMetaPatch(accounts, patch);
  await writeAccounts(next);
  return metaFromAccounts(next);
}

export async function clearMetaState(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ACCOUNTS_KEY);
  } catch {}
  try {
    await SecureStore.deleteItemAsync(LEGACY_KEY);
  } catch {}
}

/* ---------------- Account-first API (multi-account) ---------------- */

/** The canonical connected accounts, migrating the legacy flat store first. */
export async function loadAccounts(): Promise<ConnectedAccount[]> {
  return ensureMigrated();
}

/** Replace the whole account list (assumes the caller has already loaded). */
export async function saveAccounts(accounts: ConnectedAccount[]): Promise<void> {
  await writeAccounts(accounts);
}

/** Insert or replace one account by id. */
export async function upsertAccount(account: ConnectedAccount): Promise<ConnectedAccount[]> {
  const accounts = await ensureMigrated();
  const next = mergeAccount(accounts, account);
  await writeAccounts(next);
  return next;
}

/** Remove one account by id. */
export async function removeAccount(id: string): Promise<ConnectedAccount[]> {
  const accounts = await ensureMigrated();
  const next = dropAccount(accounts, id);
  await writeAccounts(next);
  return next;
}

/** Build a fresh account shell with a unique id (for "add another account"). */
export function makeAccount(provider: ProviderKey, fields: Record<string, unknown> = {}): ConnectedAccount {
  return { id: uid('acct'), provider, fields };
}

/**
 * Persist a provider's fields to a specific account (multi-account) or, when
 * no accountId is given, merge into the provider's single default account
 * (id `acct_${provider}`). Undefined values clear their field; an account
 * left empty is removed. Mirrors the old saveMetaState merge semantics.
 */
export async function saveProviderFields(
  provider: ProviderKey,
  fields: Record<string, unknown>,
  accountId?: string,
): Promise<ConnectedAccount[]> {
  const accounts = await ensureMigrated();
  const targetId = accountId ?? `acct_${provider}`;
  const existing = accounts.find((a) => a.id === targetId);
  const merged: Record<string, unknown> = { ...(existing?.fields ?? {}) };
  for (const k of Object.keys(fields)) {
    const v = fields[k];
    if (v === undefined) delete merged[k];
    else merged[k] = v;
  }
  let next: ConnectedAccount[];
  if (Object.keys(merged).length === 0) {
    next = accounts.filter((a) => a.id !== targetId);
  } else {
    next = mergeAccount(accounts, { id: targetId, provider, fields: merged });
  }
  await writeAccounts(next);
  return next;
}

/**
 * Read one account's provider fields (multi-account) or, when no accountId is
 * given, the provider's single default account (id `acct_${provider}`) —
 * matching the old flat loadMetaState view. Returns an empty object when the
 * account isn't present.
 */
export async function loadProviderFields(
  provider: ProviderKey,
  accountId?: string,
): Promise<Record<string, unknown>> {
  const accounts = await ensureMigrated();
  const targetId = accountId ?? `acct_${provider}`;
  const acct = accounts.find((a) => a.id === targetId);
  return { ...(acct?.fields ?? {}) };
}

/** Every channel with live credentials right now. */
export function connectedChannelIds(m: MetaState): string[] {
  const out: string[] = [];
  if (m.pageId && m.pageToken) out.push('facebook');
  if (m.igId && m.igToken) out.push('instagram');
  if (m.threadsId && m.threadsToken) out.push('threads');
  if (m.ttRefreshToken || m.ttAccessToken) out.push('tiktok');
  if (m.xUserId && (m.xAccessToken || m.xRefreshToken)) out.push('x');
  if (m.bskyDid && (m.bskyAccessJwt || m.bskyRefreshJwt)) out.push('bluesky');
  if (m.liPersonUrn && (m.liAccessToken || m.liRefreshToken)) out.push('linkedin');
  if (m.mastodonAccessToken && m.mastodonInstance) out.push('mastodon');
  if (m.pinAccessToken) out.push('pinterest');
  if (m.ytRefreshToken || m.ytAccessToken) out.push('youtube');
  return out;
}
