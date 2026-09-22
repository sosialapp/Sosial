import type { MetaState } from './metaStore';

export type ProviderKey =
  | 'facebook'
  | 'instagram'
  | 'threads'
  | 'tiktok'
  | 'x'
  | 'bluesky'
  | 'mastodon'
  | 'linkedin'
  | 'pinterest'
  | 'youtube';

/**
 * One social account (a.k.a. channel) with its provider-specific credentials.
 * This becomes the canonical on-device store (zap_accounts_v1). The flat
 * MetaState is kept only as a derived, single-account view so existing callers
 * keep working until the composer/analytics slices switch to account ids.
 */
export interface ConnectedAccount {
  id: string;
  provider: ProviderKey;
  /** Provider-specific credential/identity fields (subset of MetaState). */
  fields: Record<string, unknown>;
}

const PROVIDER_FIELDS: Record<ProviderKey, readonly string[]> = {
  facebook: ['fbUserToken', 'pageId', 'pageName', 'pageToken'],
  instagram: ['igToken', 'igId', 'igName'],
  threads: ['threadsToken', 'threadsId', 'threadsName'],
  tiktok: ['ttAccessToken', 'ttRefreshToken', 'ttExpiresAt', 'ttOpenId', 'ttName', 'ttLastPrivacy', 'ttPhotoHost'],
  x: ['xAccessToken', 'xRefreshToken', 'xExpiresAt', 'xUserId', 'xName'],
  bluesky: ['bskyAccessJwt', 'bskyRefreshJwt', 'bskyExpiresAt', 'bskyDid', 'bskyHandle', 'bskyName', 'bskyPdsHost'],
  mastodon: ['mastodonAccessToken', 'mastodonInstance', 'mastodonAccountId', 'mastodonName'],
  linkedin: ['liAccessToken', 'liRefreshToken', 'liExpiresAt', 'liPersonUrn', 'liName', 'liOrgId', 'liOrgName'],
  pinterest: ['pinAccessToken', 'pinRefreshToken', 'pinExpiresAt', 'pinUsername', 'pinBoardId', 'pinBoardName'],
  youtube: ['ytAccessToken', 'ytRefreshToken', 'ytExpiresAt', 'ytChannelName'],
};

const FIELD_TO_PROVIDER: Record<string, ProviderKey> = {};
for (const provider of Object.keys(PROVIDER_FIELDS) as ProviderKey[]) {
  for (const k of PROVIDER_FIELDS[provider]) FIELD_TO_PROVIDER[k] = provider;
}

export const PROVIDER_KEYS = Object.keys(PROVIDER_FIELDS) as ProviderKey[];

/** Convert the legacy flat MetaState into one account per connected provider. */
export function accountsFromMeta(m: MetaState): ConnectedAccount[] {
  const out: ConnectedAccount[] = [];
  const src = m as unknown as Record<string, unknown>;
  for (const provider of PROVIDER_KEYS) {
    const fields: Record<string, unknown> = {};
    for (const k of PROVIDER_FIELDS[provider]) {
      const v = src[k];
      if (v !== undefined) fields[k] = v;
    }
    if (Object.keys(fields).length > 0) {
      out.push({ id: `acct_${provider}`, provider, fields });
    }
  }
  return out;
}

/** Flatten accounts back into the single-account MetaState view. */
export function metaFromAccounts(accounts: ConnectedAccount[]): MetaState {
  const out: MetaState = {};
  const dst = out as unknown as Record<string, unknown>;
  for (const a of accounts) {
    for (const k of Object.keys(a.fields)) dst[k] = a.fields[k];
  }
  return out;
}

/**
 * Merge a MetaState patch into the account list. Undefined values clear the
 * corresponding field; an account left with no fields is dropped. Touches only
 * the providers named by the patch, mirroring the old saveMetaState merge.
 */
export function applyMetaPatch(
  accounts: ConnectedAccount[],
  patch: Partial<MetaState>,
): ConnectedAccount[] {
  const byProvider = new Map<ProviderKey, ConnectedAccount>();
  for (const a of accounts) byProvider.set(a.provider, a);

  const patchSrc = patch as unknown as Record<string, unknown>;
  const touched = new Set<ProviderKey>();
  for (const k of Object.keys(patchSrc)) {
    const provider = FIELD_TO_PROVIDER[k];
    if (provider) touched.add(provider);
  }

  for (const provider of touched) {
    let acct = byProvider.get(provider);
    if (!acct) acct = { id: `acct_${provider}`, provider, fields: {} };
    const fields: Record<string, unknown> = { ...acct.fields };
    for (const k of PROVIDER_FIELDS[provider]) {
      if (!Object.prototype.hasOwnProperty.call(patchSrc, k)) continue;
      const v = patchSrc[k];
      if (v !== undefined) fields[k] = v;
      else delete fields[k];
    }
    if (Object.keys(fields).length === 0) byProvider.delete(provider);
    else {
      acct.fields = fields;
      byProvider.set(provider, acct);
    }
  }

  return Array.from(byProvider.values());
}

/** Whether an account has live credentials right now (mirrors connectedChannelIds). */
export function accountConnected(a: ConnectedAccount): boolean {
  const f = a.fields;
  switch (a.provider) {
    case 'facebook': return !!(f.pageId && f.pageToken);
    case 'instagram': return !!(f.igId && f.igToken);
    case 'threads': return !!(f.threadsId && f.threadsToken);
    case 'tiktok': return !!(f.ttRefreshToken || f.ttAccessToken);
    case 'x': return !!(f.xUserId && (f.xAccessToken || f.xRefreshToken));
    case 'bluesky': return !!(f.bskyDid && (f.bskyAccessJwt || f.bskyRefreshJwt));
    case 'mastodon': return !!(f.mastodonAccessToken && f.mastodonInstance);
    case 'linkedin': return !!(f.liPersonUrn && (f.liAccessToken || f.liRefreshToken));
    case 'pinterest': return !!f.pinAccessToken;
    case 'youtube': return !!(f.ytRefreshToken || f.ytAccessToken);
    default: return false;
  }
}

/** Provider-specific stable external id (matches connected_channels.external_id). */
export function accountExternalId(a: ConnectedAccount): string | undefined {
  const f = a.fields;
  switch (a.provider) {
    case 'facebook': return f.pageId as string | undefined;
    case 'instagram': return f.igId as string | undefined;
    case 'threads': return f.threadsId as string | undefined;
    case 'tiktok': return f.ttOpenId as string | undefined;
    case 'x': return f.xUserId as string | undefined;
    case 'bluesky': return f.bskyDid as string | undefined;
    case 'mastodon': return f.mastodonAccountId as string | undefined;
    case 'linkedin': return f.liPersonUrn as string | undefined;
    case 'pinterest': return f.pinUsername as string | undefined;
    case 'youtube': return undefined;
    default: return undefined;
  }
}

/** Human-facing label for an account (page/org/handle, falling back to identity). */
export function accountName(a: ConnectedAccount): string | undefined {
  const f = a.fields;
  switch (a.provider) {
    case 'facebook': return f.pageName as string | undefined;
    case 'instagram': return f.igName as string | undefined;
    case 'threads': return f.threadsName as string | undefined;
    case 'tiktok': return f.ttName as string | undefined;
    case 'x': return f.xName as string | undefined;
    case 'bluesky': return f.bskyName as string | undefined;
    case 'mastodon': return f.mastodonName as string | undefined;
    case 'linkedin': return (f.liOrgName as string | undefined) ?? (f.liName as string | undefined);
    case 'pinterest': return (f.pinBoardName as string | undefined) ?? (f.pinUsername as string | undefined);
    case 'youtube': return f.ytChannelName as string | undefined;
    default: return undefined;
  }
}

/** Provider-hosted profile picture URL (page/org/avatar) for an account, if any. */
export function accountAvatar(a: ConnectedAccount): string | undefined {
  const v = a.fields.avatar;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Metadata-only placeholder adopted from another device's cloud copy
 * (fields.cloudOnly, no device credentials). Schedulable via the worker;
 * device-side actions need a local connect first. Derived (not stored as a
 * state machine) so landing credentials promote it automatically.
 */
export function isCloudOnly(a: ConnectedAccount): boolean {
  return a.fields.cloudOnly === true && !accountConnected(a);
}

export function connectedAccounts(accounts: ConnectedAccount[]): ConnectedAccount[] {
  return accounts.filter(accountConnected);
}

export function connectedProviderKeys(accounts: ConnectedAccount[]): ProviderKey[] {
  return connectedAccounts(accounts).map((a) => a.provider);
}

export function findAccount(accounts: ConnectedAccount[], id: string): ConnectedAccount | undefined {
  return accounts.find((a) => a.id === id);
}

/** Insert or replace an account by id; returns a new array (never mutates). */
export function upsertAccount(
  accounts: ConnectedAccount[],
  account: ConnectedAccount,
): ConnectedAccount[] {
  const idx = accounts.findIndex((a) => a.id === account.id);
  if (idx >= 0) {
    const next = accounts.slice();
    next[idx] = account;
    return next;
  }
  return [...accounts, account];
}

/** Remove an account by id; returns a new array (never mutates). */
export function removeAccount(accounts: ConnectedAccount[], id: string): ConnectedAccount[] {
  return accounts.filter((a) => a.id !== id);
}

export function findAccountForProvider(
  accounts: ConnectedAccount[],
  provider: ProviderKey,
): ConnectedAccount | undefined {
  return accounts.find((a) => a.provider === provider);
}

/** Normalize a stored per-channel pick to a list (legacy single id → one item). */
export function asIdList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return typeof v === 'string' ? [v] : [];
}
