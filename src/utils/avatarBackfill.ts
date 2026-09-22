import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadAccounts, saveProviderFields } from './metaStore';
import { accountConnected, type ConnectedAccount } from './socialAccounts';
import { fetchPages, fetchInstagramProfile, fetchThreadsProfile } from './metaAuth';
import { getValidToken, fetchTikTokProfile } from './tiktokAuth';
import { getValidXToken, fetchXProfile } from './xAuth';
import { getValidBsky } from './bskyAuth';
import { getValidMastodon, fetchMastodonProfile } from './mastodonAuth';
import { getValidLi, fetchLiProfile } from './liAuth';
import { getValidYt, fetchYtProfile } from './ytAuth';
import { getValidPin, fetchPinProfile } from './pinAuth';
import { syncCloudChannels } from './cloudChannels';

const LAST_KEY = 'avatar_backfill_at_v1';
const DAY_MS = 24 * 3600 * 1000;

/**
 * One-shot backfill for accounts connected before avatars were captured at
 * login: best-effort re-fetch every missing profile picture via the existing
 * provider fetchers (silent token refresh included), then push the fresh
 * pictures to the cloud so the web combo marks appear. Throttled to once a
 * day, never throws, never blocks — call fire-and-forget on app start.
 */
async function fetchAvatar(a: ConnectedAccount): Promise<string | undefined> {
  const f = a.fields as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
  switch (a.provider) {
    case 'facebook': {
      const tok = str(f.fbUserToken);
      if (!tok) return undefined;
      const pages = await fetchPages(tok);
      const pageId = str(f.pageId);
      const pg = pageId ? (pages.find((p) => p.id === pageId) ?? pages[0]) : pages[0];
      const url = pg?.picture?.data?.url;
      return typeof url === 'string' && url ? url : undefined;
    }
    case 'instagram': {
      const tok = str(f.igToken);
      if (!tok) return undefined;
      return (await fetchInstagramProfile(tok)).picture;
    }
    case 'threads': {
      const tok = str(f.threadsToken);
      if (!tok) return undefined;
      return (await fetchThreadsProfile(tok)).picture;
    }
    case 'tiktok': {
      const token = await getValidToken(a.id);
      return (await fetchTikTokProfile(token)).avatar;
    }
    case 'x': {
      const token = await getValidXToken(a.id);
      return (await fetchXProfile(token)).picture;
    }
    case 'bluesky': {
      const c = await getValidBsky(a.id);
      const r = await fetch(
        `${c.pdsHost}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(c.did)}`,
        { headers: { Authorization: `Bearer ${c.token}` } },
      );
      const j: any = await r.json().catch(() => ({}));
      return j?.avatar ? String(j.avatar) : undefined;
    }
    case 'mastodon': {
      const c = await getValidMastodon(a.id);
      return (await fetchMastodonProfile(c.instance, c.token)).avatar;
    }
    case 'linkedin': {
      const c = await getValidLi(a.id);
      return (await fetchLiProfile(c.token)).picture;
    }
    case 'youtube': {
      const c = await getValidYt(a.id);
      return (await fetchYtProfile(c.token)).avatar;
    }
    case 'pinterest': {
      const c = await getValidPin(a.id);
      return (await fetchPinProfile(c.token)).avatar;
    }
    default:
      return undefined;
  }
}

export interface BackfillReport {
  checked: number;
  saved: number;
  /** provider ids that failed (usually dead tokens — reconnect fixes them) */
  failed: string[];
}

export async function backfillMissingAvatars(): Promise<BackfillReport> {
  const report: BackfillReport = { checked: 0, saved: 0, failed: [] };
  try {
    const last = await AsyncStorage.getItem(LAST_KEY).catch(() => null);
    if (last && Date.now() - Number(last) < DAY_MS) return report;
    await AsyncStorage.setItem(LAST_KEY, String(Date.now())).catch(() => {});
    const accounts = await loadAccounts();
    const missing = accounts.filter(
      (a) => accountConnected(a) && typeof a.fields.avatar !== 'string',
    );
    report.checked = missing.length;
    if (missing.length === 0) return report;
    await Promise.allSettled(
      missing.map(async (a) => {
        try {
          const avatar = await fetchAvatar(a);
          if (avatar) {
            await saveProviderFields(a.provider, { avatar }, a.id);
            report.saved += 1;
          } else {
            report.failed.push(a.provider);
          }
        } catch {
          report.failed.push(a.provider);
        }
      }),
    );
    console.log(
      `[avatar] backfill: ${report.checked} missing, ${report.saved} saved` +
        (report.failed.length ? `, failed: ${[...new Set(report.failed)].join(', ')} (reconnect)` : ''),
    );
    if (report.saved > 0) syncCloudChannels().catch(() => {});
  } catch {}
  return report;
}
