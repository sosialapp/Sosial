import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadMetaState, loadAccounts, loadProviderFields, type MetaState } from './metaStore';
import { connectedAccounts } from './socialAccounts';
import { getValidYt } from './ytAuth';
import { currentSession, importChannelToken, removeChannelToken } from './supabase';

/**
 * Cloud publishing opt-in (Phase 1 → 2 bridge).
 *
 * Each connected channel can be mirrored into Vault via the
 * import-channel-token Edge Function. Device tokens stay put — the cloud copy
 * is independent, per-channel, and revocable. Local flags record which
 * channels the user enabled; the server is source of truth for nothing here.
 */

const KEY = 'sosial_cloud_channels_v1';

export type CloudChannelKey =
  | 'facebook' | 'instagram' | 'threads' | 'tiktok' | 'x'
  | 'bluesky' | 'linkedin' | 'mastodon' | 'pinterest' | 'youtube';

export async function loadCloudChannels(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function setCloudChannel(key: string, on: boolean): Promise<string[]> {
  const cur = await loadCloudChannels();
  const next = on ? [...new Set([...cur, key])] : cur.filter((k) => k !== key);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}

const iso = (ms?: number): string | undefined =>
  typeof ms === 'number' && ms > 0 ? new Date(ms).toISOString() : undefined;

export interface ImportPayload {
  provider: string;
  external_id: string;
  display_name?: string;
  handle?: string;
  instance_url?: string;
  scopes?: string[];
  metadata?: Record<string, string>;
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: string;
  refresh_expires_at?: string;
}

async function fetchYtChannelId(token: string): Promise<string | null> {
  try {
    const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j: any = await r.json().catch(() => ({}));
    const id = j?.items?.[0]?.id;
    return typeof id === 'string' && id ? id : null;
  } catch {
    return null;
  }
}

/**
 * Build the import body from device state. Null = nothing importable
 * (channel not connected, or a required id is missing) — caller alerts.
 */
export async function buildImportPayload(
  key: CloudChannelKey,
  m: MetaState,
  accountId?: string,
): Promise<ImportPayload | null> {
  const f: MetaState = accountId
    ? ({ ...m, ...(await loadProviderFields(key, accountId).catch(() => ({}))) } as MetaState)
    : m;
  // Profile picture rides in metadata so the web dashboard can render the
  // same logo+avatar combo as mobile (edge fn persists metadata on upsert;
  // re-sync refreshes existing rows, unknown avatars fall back to tiles).
  const avatarField = (f as unknown as Record<string, unknown>).avatar;
  const avatar = typeof avatarField === 'string' && avatarField ? avatarField : undefined;
  const withAvatar = (md: Record<string, string>): Record<string, string> =>
    avatar ? { ...md, avatar } : md;
  const avatarMeta = avatar ? { metadata: { avatar } } : {};
  switch (key) {
    case 'facebook':
      if (!f.pageId || !f.pageToken) return null;
      return { provider: 'facebook', external_id: f.pageId, display_name: f.pageName, access_token: f.pageToken, ...avatarMeta };
    case 'instagram':
      if (!f.igId || !f.igToken) return null;
      return { provider: 'instagram', external_id: f.igId, display_name: f.igName, access_token: f.igToken, ...avatarMeta };
    case 'threads':
      if (!f.threadsId || !f.threadsToken) return null;
      return { provider: 'threads', external_id: f.threadsId, display_name: f.threadsName, access_token: f.threadsToken, ...avatarMeta };
    case 'tiktok': {
      if (!f.ttOpenId || (!f.ttAccessToken && !f.ttRefreshToken)) return null;
      // Verified photo host rides along so closed-app photo posts can use it
      // (TikTok rejects PULL_FROM_URL hosts the user hasn't verified).
      const metadata: Record<string, string> = {};
      const host = (f.ttPhotoHost ?? '').trim().replace(/\/+$/, '');
      if (host) metadata.ttPhotoHost = host;
      return {
        provider: 'tiktok', external_id: f.ttOpenId, display_name: f.ttName,
        access_token: f.ttAccessToken ?? f.ttRefreshToken ?? '',
        refresh_token: f.ttRefreshToken, expires_at: iso(f.ttExpiresAt), metadata: withAvatar(metadata),
      };
    }
    case 'x':
      if (!f.xUserId || (!f.xAccessToken && !f.xRefreshToken)) return null;
      return {
        provider: 'x', external_id: f.xUserId, display_name: f.xName,
        access_token: f.xAccessToken ?? f.xRefreshToken ?? '',
        refresh_token: f.xRefreshToken, expires_at: iso(f.xExpiresAt),
        // Public OAuth client id — the worker needs it for silent refresh.
        metadata: withAvatar({ xClientId: process.env.EXPO_PUBLIC_X_CLIENT_ID ?? '' }),
      };
    case 'bluesky': {
      // Session tokens only — the app password itself is never stored on
      // device. When the refresh JWT dies, the user re-enables to refresh.
      if (!f.bskyDid || (!f.bskyAccessJwt && !f.bskyRefreshJwt)) return null;
      return {
        provider: 'bluesky', external_id: f.bskyDid, handle: f.bskyHandle, display_name: f.bskyName,
        instance_url: f.bskyPdsHost,
        access_token: f.bskyAccessJwt ?? f.bskyRefreshJwt ?? '',
        refresh_token: f.bskyRefreshJwt, expires_at: iso(f.bskyExpiresAt), ...avatarMeta,
      };
    }
    case 'linkedin': {
      if (!f.liPersonUrn || (!f.liAccessToken && !f.liRefreshToken)) return null;
      const metadata: Record<string, string> = {};
      if (f.liOrgId) metadata.liOrgId = f.liOrgId;
      if (f.liOrgName) metadata.liOrgName = f.liOrgName;
      return {
        provider: 'linkedin', external_id: f.liPersonUrn, display_name: f.liName,
        access_token: f.liAccessToken ?? f.liRefreshToken ?? '',
        refresh_token: f.liRefreshToken, expires_at: iso(f.liExpiresAt), metadata: withAvatar(metadata),
      };
    }
    case 'mastodon':
      if (!f.mastodonAccountId || !f.mastodonAccessToken || !f.mastodonInstance) return null;
      return {
        provider: 'mastodon', external_id: f.mastodonAccountId, display_name: f.mastodonName,
        instance_url: f.mastodonInstance, access_token: f.mastodonAccessToken, ...avatarMeta,
      };
    case 'pinterest': {
      if (!f.pinUsername || !f.pinAccessToken) return null;
      const metadata: Record<string, string> = {};
      if (f.pinBoardId) metadata.pinBoardId = f.pinBoardId;
      if (f.pinBoardName) metadata.pinBoardName = f.pinBoardName;
      return {
        provider: 'pinterest', external_id: f.pinUsername, display_name: f.pinUsername,
        access_token: f.pinAccessToken, refresh_token: f.pinRefreshToken,
        expires_at: iso(f.pinExpiresAt), metadata: withAvatar(metadata),
      };
    }
    case 'youtube': {
      if (!f.ytAccessToken && !f.ytRefreshToken) return null;
      let token = f.ytAccessToken;
      try {
        ({ token } = await getValidYt(accountId));
      } catch {
        return null;
      }
      const channelId = await fetchYtChannelId(token);
      if (!channelId) return null;
      return {
        provider: 'youtube', external_id: channelId, display_name: f.ytChannelName,
        access_token: token, refresh_token: f.ytRefreshToken,
        expires_at: iso(f.ytExpiresAt), ...avatarMeta,
      };
    }
    default:
      return null;
  }
}

/**
 * Enable cloud publishing for one channel. Throws friendly errors for the UI:
 * not signed in, nothing to import, or the function's message.
 */
export async function enableCloudChannel(key: CloudChannelKey): Promise<void> {
  const session = await currentSession();
  if (!session) throw new Error('Sign in to Sosial Cloud first (Account tab) — cloud publishing needs your workspace.');
  const accounts = await loadAccounts();
  const targets = connectedAccounts(accounts).filter((a) => a.provider === key);
  if (targets.length === 0) {
    const payload = await buildImportPayload(key, await loadMetaState());
    if (!payload) throw new Error('Reconnect this channel first — there are no credentials on this device to send.');
    await importChannelToken({ workspace_id: session.workspace.id, ...payload });
  } else {
    for (const a of targets) {
      const payload = await buildImportPayload(key, {}, a.id);
      if (payload) await importChannelToken({ workspace_id: session.workspace.id, ...payload });
    }
  }
  await setCloudChannel(key, true);
}

/**
 * Disable cloud publishing: best-effort server removal, guaranteed local
 * flag clear. Never throws — the toggle must always move. Pass the
 * pre-clear snapshot when called from a disconnect handler (avoids a
 * load-vs-clear race on SecureStore).
 */
export async function disableCloudChannel(key: CloudChannelKey, snapshot?: MetaState): Promise<void> {
  try {
    const session = await currentSession();
    const meta = snapshot ?? (await loadMetaState());
    const payload = session ? await buildImportPayload(key, meta) : null;
    if (session && payload) {
      await removeChannelToken({
        workspace_id: session.workspace.id,
        provider: payload.provider,
        external_id: payload.external_id,
      });
    } else if (session) {
      // Tokens already gone (disconnect cleared first) — provider-wide sweep.
      await removeChannelToken({ workspace_id: session.workspace.id, provider: key });
    }
  } catch {
    // server cleanup is best-effort; the flag still clears below
  }
  await setCloudChannel(key, false);
}

/* ---------------- Master switch (one setting, all channels) ---------------- */

const MASTER_KEY = 'sosial_cloud_master_v1';

/** Desired state. Always-on policy: cloud publishing cannot be switched off
 * (scheduled posts can only fire from the cloud). Absent key = true; a
 * legacy stored '0' (b37 toggle era) is migrated to '1' on first read. */
export async function loadCloudMaster(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(MASTER_KEY);
    if (raw === null) return true;
    if (raw !== '1') {
      try {
        await AsyncStorage.setItem(MASTER_KEY, '1');
      } catch {}
    }
    return true;
  } catch {
    return true;
  }
}

export async function setCloudMaster(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(MASTER_KEY, on ? '1' : '0');
  } catch {}
}

export interface CloudSyncResult {
  /** connected channels the master wants in the cloud */
  wanted: string[];
  /** already (or newly) imported */
  imported: string[];
  /** cloud copies removed */
  removed: string[];
  /** wanted but failed, with reasons for the UI */
  failed: { ch: string; message: string }[];
}

/**
 * Reconciler: makes reality match the master switch. Idempotent and safe to
 * call on every MetaState change — imports only what's missing, removes only
 * what's flagged, never throws (failures are collected, not raised).
 */
export async function syncCloudChannels(): Promise<CloudSyncResult> {
  const out: CloudSyncResult = { wanted: [], imported: [], removed: [], failed: [] };
  try {
    const master = await loadCloudMaster();
    const accounts = await loadAccounts();
    const connAccts = connectedAccounts(accounts);
    const wanted: string[] = [...new Set(connAccts.map((a) => a.provider))];
    const flags = await loadCloudChannels();
    const session = await currentSession().catch(() => null);

    if (!master) {
      // Master off: remove every flagged cloud copy (provider-wide when the
      // device tokens needed for a precise external_id are already gone).
      const meta = await loadMetaState();
      for (const ch of flags) {
        try {
          if (session) {
            const payload = await buildImportPayload(ch as CloudChannelKey, meta).catch(() => null);
            if (payload) {
              await removeChannelToken({
                workspace_id: session.workspace.id,
                provider: payload.provider,
                external_id: payload.external_id,
              });
            } else {
              await removeChannelToken({ workspace_id: session.workspace.id, provider: ch });
            }
          }
        } catch {}
        await setCloudChannel(ch, false);
        out.removed.push(ch);
      }
      return out;
    }

    out.wanted = wanted;
    if (!session) return out; // desired state waits for sign-in; no failure
    const flagged = new Set(flags);
    for (const a of connAccts) {
      const ch = a.provider;
      try {
        const payload = await buildImportPayload(ch, {}, a.id);
        if (!payload) {
          if (!out.failed.some((f) => f.ch === ch)) out.failed.push({ ch, message: 'Reconnect this channel first.' });
          continue;
        }
        await importChannelToken({ workspace_id: session.workspace.id, ...payload });
        if (!flagged.has(ch)) {
          await setCloudChannel(ch, true);
          flagged.add(ch);
        }
        if (!out.imported.includes(ch)) out.imported.push(ch);
      } catch (e: any) {
        if (!out.failed.some((f) => f.ch === ch)) out.failed.push({ ch, message: e?.message ?? 'Import failed.' });
      }
    }
    // Heal stale flags (e.g. a disconnect whose server cleanup failed).
    for (const ch of flags) {
      if (!wanted.includes(ch)) {
        try {
          await removeChannelToken({ workspace_id: session.workspace.id, provider: ch });
        } catch {}
        await setCloudChannel(ch, false);
        out.removed.push(ch);
      }
    }
    return out;
  } catch {
    return out;
  }
}
