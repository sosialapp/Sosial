'use client';

import { useEffect, useState } from 'react';
import IntegrationsTab from '@/components/IntegrationsTab';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { BrandIcon, type BrandProvider } from './BrandIcon';
import ChannelAvatar from './ChannelAvatar';
import { channelAvatar } from '@/lib/channelAvatar';
import DisconnectChannel from './DisconnectChannel';
import PinBoardPicker from './PinBoardPicker';
import { OAUTH_PROVIDERS, oauthLabel, type OAuthProvider } from '@/lib/oauth';
import { canConnectProvider, type PlanKey } from '@/lib/billing/plans';
import type { ConnectedChannel } from '@/lib/types';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';
import { fill } from '@/lib/i18n/locales';
import SegmentedPills from '@/components/ui/segmented-pills';

export interface FbPickPage {
  id: string;
  name: string;
  picture?: string;
  ig?: string;
  /** Graph listed the Page but issued no token (no content role). */
  missing?: boolean;
}

export interface GmbPickLocation {
  name: string;
  title: string;
}

type ProviderId = OAuthProvider | 'bluesky' | 'telegram' | 'discord' | 'wordpress' | 'devto' | 'hashnode' | 'ghost' | 'vk';

const ORDER: ProviderId[] = [...OAUTH_PROVIDERS.map((p) => p.id), 'bluesky', 'telegram', 'discord', 'wordpress', 'devto', 'hashnode', 'ghost', 'vk'];

const MANUAL: Partial<Record<ProviderId, boolean>> = { bluesky: true, mastodon: true, telegram: true, discord: true, wordpress: true, devto: true, hashnode: true, ghost: true, vk: true };

/** Listed but not connectable yet, shows a Soon tag instead of Connect.
 *  gmb: allowlist pending. linkedin: production approval pending
 *  (dev-mode connects still work via direct URL for testing). */
const COMING_SOON: ProviderId[] = ['gmb', 'linkedin'];

function providerLabel(p: ProviderId): string {
  if (p === 'bluesky') return 'Bluesky';
  if (p === 'telegram') return 'Telegram';
  if (p === 'discord') return 'Discord';
  if (p === 'wordpress') return 'WordPress';
  if (p === 'devto') return 'Dev.to';
  if (p === 'hashnode') return 'Hashnode';
  if (p === 'ghost') return 'Ghost';
  if (p === 'vk') return 'VK';
  if (p === 'gmb') return 'Google Business';
  return oauthLabel(p);
}

function accountName(c: ConnectedChannel): string {
  if (c.provider === 'discord') {
    const md = (c.metadata ?? {}) as Record<string, unknown>;
    const guild = typeof md.guildName === 'string' ? md.guildName : '';
    const ch = (c.display_name ?? c.external_id).replace(/^#/, '') || c.external_id;
    return guild ? `${guild} / #${ch}` : `#${ch}`;
  }
  return c.display_name ?? (c.handle ? `@${c.handle}` : c.handle) ?? c.external_id;
}

const DOT: Record<string, string> = {
  connected: 'bg-[#2f8f5b]',
  expired: 'bg-[#e6a417]',
  revoked: 'bg-[#E60023]',
  error: 'bg-[#E60023]',
};

/**
 * Mobile-style Connect list: one row per provider, tap to expand into its
 * accounts. OAuth rows with no accounts connect immediately; otherwise the
 * row expands to account rows (avatar + name + status + remove), the
 * provider's picker (Facebook Pages), and an "add another account" action -
 * the browser sends whichever account is signed in at the provider, so a
 * second account means switching the login there first.
 */
export default function ConnectPanel({
  workspaceId,
  channels,
  fbPick,
  fbOmitted = 0,
  gmbPick,
  status,
  canManage,
  plan,
}: {
  workspaceId: string;
  channels: ConnectedChannel[];
  /** Facebook Pages waiting for a pick (from ?connect=facebook). */
  fbPick: FbPickPage[] | null;
  /** Pages dropped from the pick cookie because they did not fit. */
  fbOmitted?: number;
  /** GBP locations waiting for a pick (from ?connect=gmb). */
  gmbPick: GmbPickLocation[] | null;
  /** Result banners (from ?connected= / ?error=). */
  status: { connected?: string; already?: string; error?: string };
  /** Owners and admins, they see Remove/disconnect and every connect
   *  action. Ordinary members get a read-only list plus a note. */
  canManage: boolean;
  /** Workspace plan, paywalled providers (X) show an upgrade nudge on free. */
  plan: PlanKey;
}) {
  const [open, setOpen] = useState<ProviderId | null>(
    fbPick ? 'facebook' : gmbPick ? 'gmb' : null,
  );
  const [bskyHandle, setBskyHandle] = useState('');
  const [bskyPass, setBskyPass] = useState('');
  /** channel_id → token is stale (expiry older than 1h). A stale token means
   *  the hourly refresh never landed, the channel is dead even while its
   *  status row still says 'connected'. Refreshed on mount. */
  const [staleIds, setStaleIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const sb = createClient();
        const { data } = await sb.rpc('channel_health', { p_workspace_id: workspaceId });
        if (!alive || !Array.isArray(data)) return;
        setStaleIds(
          new Set(
            (data as { channel_id: string; token_stale: boolean }[])
              .filter((r) => r.token_stale)
              .map((r) => r.channel_id),
          ),
        );
      } catch {
        // health is advisory, the status column still drives the badges
      }
    })();
    return () => {
      alive = false;
    };
  }, [workspaceId]);
  /** Dead = worker-marked expired, or token stale past the refresh window. */
  const isDead = (c: ConnectedChannel) => c.status === 'expired' || staleIds.has(c.id);
  const [mastodonInstance, setMastodonInstance] = useState('');
  const [tgToken, setTgToken] = useState('');
  const [tgChat, setTgChat] = useState('');
  const [wpSite, setWpSite] = useState('');
  const [wpUser, setWpUser] = useState('');
  const [wpPass, setWpPass] = useState('');
  const [devKey, setDevKey] = useState('');
  const [hnToken, setHnToken] = useState('');
  const [hnPubs, setHnPubs] = useState<{ id: string; title: string; url: string }[]>([]);
  const [hnPub, setHnPub] = useState('');
  const [ghSite, setGhSite] = useState('');
  const [ghKey, setGhKey] = useState('');
  const [vkCommunity, setVkCommunity] = useState('');
  const [vkKey, setVkKey] = useState('');
  const [dcToken, setDcToken] = useState('');
  const [dcGuilds, setDcGuilds] = useState<{ id: string; name: string }[]>([]);
  const [dcGuild, setDcGuild] = useState('');
  const [dcChannels, setDcChannels] = useState<{ id: string; name: string }[]>([]);
  const [dcThreads, setDcThreads] = useState<{ id: string; name: string; parent_id: string; parent_name: string }[]>([]);
  const [dcChannel, setDcChannel] = useState('');
  const [query, setQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncedNote, setSyncedNote] = useState<string | null>(null);
  /** Channels publish; integrations feed the composer. Separate tabs. */
  const [tab, setTab] = useState<'channels' | 'integrations'>('channels');

  /** On-demand health check: worker revalidates every token, avatars refresh,
   *  then we poll a few times while statuses land. */
  async function syncNow() {
    if (!canManage) {
      setErr(t('cnErrSyncManage'));
      return;
    }
    setSyncing(true);
    setErr(null);
    setSyncedNote(null);
    try {
      const r = await fetch('/api/channels/sync', { method: 'POST' });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; queued_refresh?: number; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error ?? t('cnSyncFail'));
      setSyncedNote(
        fill(t('cnSyncChecking'), { n: j.queued_refresh ?? 0 }),
      );
      for (let i = 0; i < 5; i++) {
        await new Promise((res) => setTimeout(res, 5000));
        router.refresh();
      }
      setSyncedNote(t('cnSyncDone'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cnSyncFail'));
    } finally {
      setSyncing(false);
    }
  }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t = useT(appMessages);
  const [picking, setPicking] = useState<string | null>(null);
  /** A connect navigation is already in flight, swallow extra taps. */
  const [leaving, setLeaving] = useState<ProviderId | null>(null);
  const router = useRouter();

  // Consent happens in a new tab; this tab goes stale while the user is
  // away, so refresh the list whenever they come back to it. A return also
  // means any in-flight connect navigation was abandoned (cancelled in the
  // other tab) or completed elsewhere, either way the tap-lock must reset
  // or every connect button stays dead.
  useEffect(() => {
    const refresh = () => {
      setLeaving(null);
      router.refresh();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', refresh);
    };
  }, [router]);

  const byProvider = (p: string): ConnectedChannel[] => channels.filter((c) => c.provider === p);
  const matchesQuery = (p: ProviderId): boolean => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const list = byProvider(p);
    return (
      providerLabel(p).toLowerCase().includes(q) ||
      list.some((c) =>
        [accountName(c), c.handle ?? '', c.external_id].some((v) => v.toLowerCase().includes(q)),
      )
    );
  };
  const ordered: ProviderId[] = [...ORDER].sort((a, b) => {
    // Soon rows always sink to the very bottom, connected next.
    const soonOf = (p: ProviderId) => (COMING_SOON.includes(p) ? 1 : 0);
    const rank = (p: ProviderId) => (byProvider(p).length > 0 ? 1 : 0);
    return soonOf(a) - soonOf(b) || rank(b) - rank(a);
  });
  const visible = ordered.filter(matchesQuery);

  const startHref = (p: OAuthProvider): string =>
    `/api/oauth/start?provider=${p}&workspace_id=${encodeURIComponent(workspaceId)}`;

  async function connectBsky() {
    setErr(null);
    if (!canManage) {
      setErr(t('cnErrManage'));
      return;
    }
    if (!bskyHandle.trim()) {
      setErr(t('cnBskyHandleFirst'));
      return;
    }
    if (!bskyPass) {
      setErr(t('cnBskyPass'));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/oauth/bluesky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, handle: bskyHandle.trim(), app_password: bskyPass }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; already?: boolean; error?: string };
      if (j.already) {
        window.location.href = '/channels?already=bluesky';
        return;
      }
        if (!j.ok) throw new Error(j.error ?? `${t('cnBskyFail')} (${r.status})`);
      window.location.href = '/channels?connected=bluesky';
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cnBskyFail'));
    } finally {
      setBusy(false);
    }
  }

  async function connectMastodon() {
    setErr(null);
    if (!canManage) {
      setErr(t('cnErrManage'));
      return;
    }
    if (!mastodonInstance.trim()) {
      setErr(t('cnMastoInstance'));
      return;
    }
    setBusy(true);
    // Open the tab synchronously in the tap handler, awaiting the
    // registration first would trip popup blockers.
    const tab = window.open('about:blank', '_blank');
    try {
      const r = await fetch('/api/oauth/mastodon-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, instance: mastodonInstance.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!j.url) throw new Error(j.error ?? t('cnMastoRegister'));
      if (tab) tab.location.href = j.url;
      else window.location.href = j.url;
    } catch (e) {
      try {
        tab?.close();
      } catch {
        /* already gone */
      }
      setErr(e instanceof Error ? e.message : t('cnMastoRegister'));
      setBusy(false);
    }
  }

  type DcList = {
    guilds?: { id: string; name: string }[];
    channels?: { id: string; name: string }[];
    threads?: { id: string; name: string; parent_id: string; parent_name: string }[];
    error?: string;
  };

  async function dcCall(stage: { guild_id?: string; channel_id?: string }): Promise<DcList> {
    const r = await fetch('/api/oauth/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_token: dcToken.trim(), ...stage }),
    });
    const j = (await r.json().catch(() => ({}))) as DcList & { ok?: boolean };
    if (!r.ok || (j as { error?: string }).error) {
      throw new Error((j as { error?: string }).error ?? t('cnDcFail'));
    }
    return j;
  }

  async function loadDcGuilds() {
    setErr(null);
    if (!canManage) {
      setErr(t('cnErrManage'));
      return;
    }
    if (!dcToken.trim()) {
      setErr(t('cnDcToken'));
      return;
    }
    setBusy(true);
    try {
      const j = await dcCall({});
      setDcGuilds(j.guilds ?? []);
      setDcGuild('');
      setDcChannels([]);
      setDcChannel('');
      if (!(j.guilds ?? []).length) setErr(t('cnDcNoServers'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cnDcReach'));
    } finally {
      setBusy(false);
    }
  }

  async function loadDcChannels(guildId: string) {
    setDcGuild(guildId);
    setDcChannels([]);
    setDcThreads([]);
    setDcChannel('');
    if (!guildId) return;
    setBusy(true);
    try {
      const j = await dcCall({ guild_id: guildId });
      setDcChannels(j.channels ?? []);
      setDcThreads(j.threads ?? []);
      if (!(j.channels ?? []).length && !(j.threads ?? []).length) setErr(t('cnDcNoChannels'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cnDcList'));
    } finally {
      setBusy(false);
    }
  }

  async function connectDiscord() {
    setErr(null);
    if (!canManage) {
      setErr(t('cnErrManage'));
      return;
    }
    if (!dcChannel) {
      setErr(t('cnDcPick'));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/oauth/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: dcToken.trim(), guild_id: dcGuild, channel_id: dcChannel }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? t('cnDcFail'));
      window.location.href = '/channels?connected=discord';
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cnDcFail'));
    } finally {
      setBusy(false);
    }
  }

  type HnList = { publications?: { id: string; title: string; url: string }[]; error?: string };

  async function hnCall(stage: { publication_id?: string }): Promise<HnList> {
    const r = await fetch('/api/oauth/hashnode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pat: hnToken.trim(), ...stage }),
    });
    const j = (await r.json().catch(() => ({}))) as HnList & { ok?: boolean };
    if (!r.ok || (j as { error?: string }).error) {
      throw new Error((j as { error?: string }).error ?? t('cnHnFail'));
    }
    return j;
  }

  async function loadHnPubs() {
    setErr(null);
    if (!canManage) {
      setErr(t('cnErrManage'));
      return;
    }
    if (!hnToken.trim()) {
      setErr(t('cnHnToken'));
      return;
    }
    setBusy(true);
    try {
      const j = await hnCall({});
      setHnPubs(j.publications ?? []);
      setHnPub('');
      if (!(j.publications ?? []).length) {
        setErr(t('cnHnNoPubs'));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cnHnReach'));
    } finally {
      setBusy(false);
    }
  }

  async function connectHashnode() {
    setErr(null);
    if (!canManage) {
      setErr(t('cnErrManage'));
      return;
    }
    if (!hnPub) {
      setErr(t('cnHnPick'));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/oauth/hashnode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pat: hnToken.trim(), publication_id: hnPub }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? t('cnHnFail'));
      window.location.href = '/channels?connected=hashnode';
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cnHnFail'));
    } finally {
      setBusy(false);
    }
  }

  async function connectVk() {
    setErr(null);
    if (!canManage) {
      setErr(t('cnErrManage'));
      return;
    }
    if (!vkCommunity.trim()) {
      setErr(t('cnVkCommunity'));
      return;
    }
    if (!vkKey) {
      setErr(t('cnVkKey'));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/oauth/vk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ community: vkCommunity.trim(), access_token: vkKey.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? t('cnVkFail'));
      window.location.href = '/channels?connected=vk';
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cnVkFail'));
    } finally {
      setBusy(false);
    }
  }

  async function connectGhost() {    setErr(null);
    if (!canManage) {
      setErr(t('cnErrManage'));
      return;
    }
    if (!ghSite.trim()) {
      setErr(t('cnGhostSite'));
      return;
    }
    if (!ghKey) {
      setErr(t('cnGhostKey'));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/oauth/ghost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_url: ghSite.trim(), admin_key: ghKey.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? t('cnGhostFail'));
      window.location.href = '/channels?connected=ghost';
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cnGhostFail'));
    } finally {
      setBusy(false);
    }
  }

  async function connectDevto() {
    setErr(null);
    if (!canManage) {
      setErr(t('cnErrManage'));
      return;
    }
    if (!devKey.trim()) {
      setErr(t('cnDevtoKey'));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/oauth/devto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: devKey.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? t('cnDevtoFail'));
      window.location.href = '/channels?connected=devto';
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cnDevtoFail'));
    } finally {
      setBusy(false);
    }
  }

  async function connectWordPress() {
    setErr(null);
    if (!canManage) {
      setErr(t('cnErrManage'));
      return;
    }
    if (!wpSite.trim()) {
      setErr(t('cnWpSite'));
      return;
    }
    if (!wpUser.trim()) {
      setErr(t('cnWpUser'));
      return;
    }
    if (!wpPass) {
      setErr(t('cnWpPass'));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/oauth/wordpress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_url: wpSite.trim(),
          username: wpUser.trim(),
          app_password: wpPass,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? t('cnWpFail'));
      window.location.href = '/channels?connected=wordpress';
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cnWpFail'));
    } finally {
      setBusy(false);
    }
  }

  async function connectTelegram() {    setErr(null);
    if (!canManage) {
      setErr(t('cnErrManage'));
      return;
    }
    if (!tgToken.trim()) {
      setErr(t('cnTgToken'));
      return;
    }
    if (!tgChat.trim()) {
      setErr(t('cnTgChat'));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/oauth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: tgToken.trim(), chat_id: tgChat.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? t('cnTgFail'));
      window.location.href = '/channels?connected=telegram';
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cnTgFail'));
    } finally {
      setBusy(false);
    }
  }

  async function pickPage(id: string) {
    setErr(null);
    setPicking(id);
    try {
      const r = await fetch('/api/oauth/facebook-finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: id }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; already?: boolean; error?: string };
      if (j.already) {
        window.location.href = '/channels?already=facebook';
        return;
      }
      if (!j.ok) throw new Error(j.error ?? t('cnPageFail'));
      window.location.href = '/channels?connected=facebook';
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cnPageFail'));
    } finally {
      setPicking(null);
    }
  }

  async function pickLocation(name: string) {
    setErr(null);
    setPicking(name);
    try {
      const r = await fetch('/api/oauth/gmb-finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: name }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; already?: boolean; error?: string };
      if (j.already) {
        window.location.href = '/channels?already=gmb';
        return;
      }
      if (!j.ok) throw new Error(j.error ?? t('cnLocFail'));
      window.location.href = '/channels?connected=gmb';
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cnLocFail'));
    } finally {
      setPicking(null);
    }
  }

  const subtitle = (p: ProviderId, list: ConnectedChannel[]): string => {    if (list.length === 0) {
      if (p === 'bluesky') return t('cnSubBsky');
      if (p === 'mastodon') return t('cnSubMasto');
      if (p === 'telegram') return t('cnSubTg');
      if (p === 'discord') return t('cnSubDc');
      if (p === 'wordpress') return t('cnSubWp');
      if (p === 'devto') return t('cnSubDevto');
      if (p === 'hashnode') return t('cnSubHn');
      if (p === 'ghost') return t('cnSubGhost');
      if (p === 'vk') return t('cnSubVk');
      if (p === 'gmb') return t('cnSubGmb');
      return t('cnSubTap');
    }
    if (list.length === 1) {
      const one = list[0];
      if (p === 'pinterest') {
        const md = (one.metadata ?? {}) as Record<string, unknown>;
        if (typeof md.pinBoardId !== 'string' || !md.pinBoardId) {
          return `${accountName(one)} · ${t('cnPickBoard')}`;
        }
      }
      return accountName(one);
    }
    return fill(t('cnNAccounts'), { n: list.length });
  };

  const alreadyLabel =
    status.already === 'bluesky'
      ? 'Bluesky'
      : status.already === 'telegram'
        ? 'Telegram'
        : status.already === 'discord'
          ? 'Discord'
          : status.already === 'wordpress'
            ? 'WordPress'
            : status.already === 'devto'
              ? 'Dev.to'
              : status.already === 'hashnode'
                ? 'Hashnode'
                : status.already === 'ghost'
                  ? 'Ghost'
                  : status.already === 'vk'
                    ? 'VK'
                    : status.already
                      ? oauthLabel(status.already)
                      : '';
  const connectedLabel =
    status.connected === 'bluesky'
      ? 'Bluesky'
      : status.connected === 'telegram'
        ? 'Telegram'
        : status.connected === 'discord'
          ? 'Discord'
          : status.connected === 'wordpress'
            ? 'WordPress'
            : status.connected === 'devto'
              ? 'Dev.to'
              : status.connected === 'hashnode'
                ? 'Hashnode'
                : status.connected === 'ghost'
                  ? 'Ghost'
                  : status.connected === 'vk'
                    ? 'VK'
                    : status.connected
                      ? oauthLabel(status.connected)
                      : '';

  return (
    <div className="space-y-3">
      {status.connected ? (
        <p className="rounded-xl bg-[#EDF3EC] px-3.5 py-2.5 text-xs font-bold text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]">
          {fill(t('cnConnectedOk'), { label: connectedLabel })}
        </p>
      ) : null}
      {status.already ? (
        <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-xs font-bold text-accent-ink">
          {fill(t('cnAlready'), { label: alreadyLabel })}
        </p>
      ) : null}
      {status.error ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {status.error}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      ) : null}
      {!canManage ? (
        <p className="rounded-xl bg-paper-dim px-3.5 py-2.5 text-xs font-bold text-muted">
          You can see the workspace channels here, but only owners and admins can connect or remove them.
        </p>
      ) : null}

      <SegmentedPills
        ariaLabel={t('cChannels')}
        role="tablist"
        className="w-fit"
        value={tab}
        onChange={setTab}
        options={(['channels', 'integrations'] as const).map((tb) => ({
          value: tb,
          label: tb === 'channels' ? t('cnTabChannels') : t('cnTabIntegrations'),
        }))}
      />

      {tab === 'integrations' ? (
        <IntegrationsTab />
      ) : (
      <>
      <div className="mb-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('cnSearchPh')}
          aria-label={t('cnSearchAria')}
          className="field min-w-0 flex-1"
        />
        {canManage ? (
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing}
            className="shrink-0 rounded-full border border-line bg-card px-4 py-2 text-xs font-bold text-soft transition hover:bg-paper disabled:opacity-50"
          >
            {syncing ? t('cnChecking') : t('cnSync')}
          </button>
        ) : null}
      </div>
      {syncedNote ? (
        <p className="mb-3 rounded-xl bg-paper-dim px-3.5 py-2 text-xs font-bold text-muted">{syncedNote}</p>
      ) : null}
      <section aria-label={t('cnTabChannels')} className="overflow-hidden rounded-2xl border border-line bg-card">
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">
            {fill(t('cnNoMatch'), { q: query.trim() })}
          </p>
        ) : null}
        {visible.map((p, pi) => {
          const list = byProvider(p);
          const hasAny = list.length > 0;
          const expanded = open === p;
          const manual = MANUAL[p] === true;
          const soon = COMING_SOON.includes(p);
          const label = providerLabel(p);
          const pinMd = (list[0]?.metadata ?? {}) as Record<string, unknown>;

          const onRow = () => {
            // Coming soon: expand to the note, never start OAuth.
            if (soon) {
              setOpen(expanded ? null : p);
              return;
            }
            // Paywalled providers on free: explain instead of opening OAuth
            // (the server route enforces the same rule, this just says it first).
            if (!manual && !hasAny && !canConnectProvider(plan, p)) {
              setErr(t('cnXPaywall'));
              return;
            }
            // No accounts yet on an OAuth provider: consent opens in a new
            // tab so this page keeps its place. Members can't start connects.
            if (!manual && !hasAny) {
              if (!canManage) {
      setErr(t('cnErrManage'));
                return;
              }
              if (leaving) return;
              setLeaving(p);
              window.open(startHref(p as OAuthProvider), '_blank', 'noopener');
              return;
            }
            setOpen(expanded ? null : p);
          };

          return (
            <div key={p} className={pi === 0 ? '' : 'border-t border-line-soft'}>
              <button
                type="button"
                onClick={onRow}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-paper/60"
              >
                <BrandIcon provider={p as BrandProvider} className="h-10 w-10" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="block text-sm font-extrabold tracking-tight">{label}</span>
                    {list.some((c) => isDead(c)) ? (
                      <AlertTriangle
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-[#8a6100] dark:text-[#e6a417]"
                      />
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-muted">{subtitle(p, list)}</span>
                </span>
                {hasAny || manual ? (
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 text-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
                  />
                ) : soon ? (
                  <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent-ink">{t('cnSoon')}</span>
                ) : !canConnectProvider(plan, p) ? (
                  <span className="shrink-0 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-paper" title={t('cnNeedsPlan')}>Pro</span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-accent-ink" title={t('cnOpensNewTab')}>
                    {t('cnConnect')}
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </span>
                )}
              </button>

              {expanded ? (
                <div className="space-y-2 px-4 pb-4">
                  {list.map((c) => (
                    <div key={c.id} className="rounded-xl px-1 py-1">
                      <div className="flex items-center gap-2.5">
                        <ChannelAvatar
                          provider={c.provider}
                          avatar={channelAvatar(c.metadata)}
                          size={30}
                          badge={list.length > 1}
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{accountName(c)}</span>
                        {isDead(c) ? (
                          <span
                            className="flex shrink-0 items-center gap-1 rounded-full bg-[#FDF3D7] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#8a6100] dark:bg-[#2b2417] dark:text-[#e6a417]"
                            title={c.last_error ?? t('cnSessionExpired')}
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            {t('cnReconnect')}
                          </span>
                        ) : (
                          <span
                            aria-label={c.status}
                            title={c.status}
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[c.status] ?? 'bg-surface'}`}
                          />
                        )}
                        {canManage ? (
                          <DisconnectChannel
                            workspaceId={workspaceId}
                            provider={c.provider}
                            externalId={c.external_id}
                            label={accountName(c)}
                          />
                        ) : null}
                      </div>
                      {isDead(c) ? (
                        <p className="mt-1 truncate pl-[40px] pr-2 text-[11px] text-[#8a6100] dark:text-[#e6a417]" title={c.last_error ?? undefined}>
                          {c.last_error ?? t('cnSessionExpired')}
                        </p>
                      ) : null}
                    </div>
                  ))}

                  {p === 'bluesky' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <p className="text-[11px] leading-relaxed text-muted">
                        {t('cnBskyNote')}
                      </p>
                      <input
                        value={bskyHandle}
                        onChange={(e) => setBskyHandle(e.target.value.trim())}
                        placeholder={t('cnBskyHandlePh')}
                        autoComplete="username"
                        spellCheck={false}
                        aria-label={t('cnBskyHandleAria')}
                        className="field !text-xs"
                      />
                      <p className="px-1 text-[10px] leading-relaxed text-faint">{t('cnBskyOk')}</p>
                      <input
                        value={bskyPass}
                        onChange={(e) => setBskyPass(e.target.value)}
                        placeholder={t('cnBskyPassPh')}
                        type="password"
                        autoComplete="new-password"
                        aria-label={t('cnBskyPassAria')}
                        className="field !text-xs"
                      />
                      <button type="button" onClick={connectBsky} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                        {busy ? t('cnConnecting') : hasAny ? t('cnAddAccount') : t('cnConnectBsky')}
                      </button>
                    </div>
                  ) : null}
                  {p === 'mastodon' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <p className="text-[11px] leading-relaxed text-muted">
                        {t('cnMastoNote')}
                      </p>
                      <input
                        value={mastodonInstance}
                        onChange={(e) => setMastodonInstance(e.target.value)}
                        placeholder={t('cnMastoPh')}
                        autoComplete="username"
                        aria-label={t('cnMastoAria')}
                        className="field !text-xs"
                      />
                      <button type="button" onClick={connectMastodon} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                        {busy ? t('cnRegistering') : hasAny ? t('cnAddAccount') : t('cnConnectMasto')}
                      </button>
                    </div>
                  ) : null}

                  {p === 'discord' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-muted">
                        <li>
                          Create an app in the{' '}
                          <a href="https://discord.com/developers/home" target="_blank" rel="noopener" className="font-bold text-accent-ink hover:underline">
                            Discord Developer Portal
                          </a>{' '}
                          {t('cnDcStep1b')}
                        </li>
                        <li>{t('cnDcStep2')}</li>
                        <li>{t('cnDcStep3')}</li>
                      </ol>
                      <input
                        value={dcToken}
                        onChange={(e) => {
                          setDcToken(e.target.value);
                          setDcGuilds([]);
                          setDcGuild('');
                          setDcChannels([]);
                          setDcChannel('');
                        }}
                        placeholder={t('cnDcTokenPh')}
                        type="password"
                        autoComplete="new-password"
                        aria-label={t('cnDcTokenAria')}
                        className="field !text-xs"
                      />
                      {dcGuilds.length === 0 ? (
                        <button type="button" onClick={loadDcGuilds} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                          {busy ? t('cnDcAsking') : t('cnDcListBtn')}
                        </button>
                      ) : (
                        <>
                          <select
                            value={dcGuild}
                            onChange={(e) => loadDcChannels(e.target.value)}
                            aria-label={t('cnDcServerAria')}
                            className="field !text-xs"
                          >
                            <option value="">{t('cnPickServer')}</option>
                            {dcGuilds.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                          {dcChannels.length > 0 || dcThreads.length > 0 ? (
                            <select
                              value={dcChannel}
                              onChange={(e) => setDcChannel(e.target.value)}
                              aria-label={t('cnDcChannelAria')}
                              className="field !text-xs"
                            >
                              <option value="">{t('cnPickChannel')}</option>
                              {dcChannels.length > 0 ? (
                                <optgroup label={t('cnOptChannels')}>
                                  {dcChannels.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      #{c.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null}
                              {dcThreads.length > 0 ? (
                                <optgroup label={t('cnOptThreads')}>
                                  {dcThreads.map((dt) => (
                                    <option key={dt.id} value={dt.id}>
                                      #{dt.parent_name || t('cnThreadWord')} › {dt.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null}
                            </select>
                          ) : null}
                          <button type="button" onClick={connectDiscord} disabled={busy || !dcChannel} className="btn btn-primary w-full !py-2 !text-xs">
                            {busy ? t('cnConnecting') : hasAny ? t('cnAddChannel') : t('cnConnectDc')}
                          </button>
                          {err ? (
                            <p className="rounded-xl bg-[#FDEBEC] px-3 py-2 text-[11px] font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                              {err}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}

                  {p === 'ghost' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <p className="text-[11px] leading-relaxed text-muted">
                        {t('cnGhostNote')}
                      </p>
                      <input
                        value={ghSite}
                        onChange={(e) => setGhSite(e.target.value)}
                        placeholder={t('cnSitePh')}
                        inputMode="url"
                        autoComplete="url"
                        aria-label={t('cnGhostSiteAria')}
                        className="field !text-xs"
                      />
                      <input
                        value={ghKey}
                        onChange={(e) => setGhKey(e.target.value)}
                        placeholder={t('cnGhostKeyPh')}
                        type="password"
                        autoComplete="new-password"
                        aria-label={t('cnGhostKeyAria')}
                        className="field !text-xs"
                      />
                      {err ? (
                        <p className="rounded-xl bg-[#FDEBEC] px-3 py-2 text-[11px] font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                          {err}
                        </p>
                      ) : null}
                      <button type="button" onClick={connectGhost} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                        {busy ? t('cnCheckingSite') : hasAny ? t('cnAddSite') : t('cnConnectGhost')}
                      </button>
                    </div>
                  ) : null}

                  {p === 'vk' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <p className="text-[11px] leading-relaxed text-muted">
                        {t('cnVkNote')}
                      </p>
                      <input
                        value={vkCommunity}
                        onChange={(e) => setVkCommunity(e.target.value)}
                        placeholder={t('cnVkPh')}
                        autoComplete="url"
                        aria-label={t('cnVkAria')}
                        className="field !text-xs"
                      />
                      <input
                        value={vkKey}
                        onChange={(e) => setVkKey(e.target.value)}
                        placeholder={t('cnVkKeyPh')}
                        type="password"
                        autoComplete="new-password"
                        aria-label={t('cnVkKeyAria')}
                        className="field !text-xs"
                      />
                      {err ? (
                        <p className="rounded-xl bg-[#FDEBEC] px-3 py-2 text-[11px] font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                          {err}
                        </p>
                      ) : null}
                      <button type="button" onClick={connectVk} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                        {busy ? t('cnAskingVk') : hasAny ? t('cnAddCommunity') : t('cnConnectVk')}
                      </button>
                    </div>
                  ) : null}

                  {p === 'hashnode' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <p className="text-[11px] leading-relaxed text-muted">
                        {t('cnHnNote')}
                      </p>
                      <input
                        value={hnToken}
                        onChange={(e) => {
                          setHnToken(e.target.value);
                          setHnPubs([]);
                          setHnPub('');
                        }}
                        placeholder={t('cnHnTokenPh')}
                        type="password"
                        autoComplete="new-password"
                        aria-label={t('cnHnTokenAria')}
                        className="field !text-xs"
                      />
                      {hnPubs.length === 0 ? (
                        <button type="button" onClick={loadHnPubs} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                          {busy ? t('cnAskingHn') : t('cnListPubs')}
                        </button>
                      ) : (
                        <>
                          <select
                            value={hnPub}
                            onChange={(e) => setHnPub(e.target.value)}
                            aria-label={t('cnHnPubAria')}
                            className="field !text-xs"
                          >
                            <option value="">{t('cnPickPub')}</option>
                            {hnPubs.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.title}
                              </option>
                            ))}
                          </select>
                          <button type="button" onClick={connectHashnode} disabled={busy || !hnPub} className="btn btn-primary w-full !py-2 !text-xs">
                            {busy ? t('cnConnecting') : hasAny ? t('cnAddPub') : t('cnConnectHn')}
                          </button>
                          {err ? (
                            <p className="rounded-xl bg-[#FDEBEC] px-3 py-2 text-[11px] font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                              {err}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}

                  {p === 'devto' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <p className="text-[11px] leading-relaxed text-muted">
                        {t('cnDevtoNote')}
                      </p>
                      <input
                        placeholder={t('cnDevtoKeyPh')}
                        type="password"
                        autoComplete="new-password"
                        aria-label={t('cnDevtoKeyAria')}
                        className="field !text-xs"
                      />
                      {err ? (
                        <p className="rounded-xl bg-[#FDEBEC] px-3 py-2 text-[11px] font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                          {err}
                        </p>
                      ) : null}
                      <button type="button" onClick={connectDevto} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                        {busy ? t('cnCheckingDevto') : hasAny ? t('cnAddAccount') : t('cnConnectDevto')}
                      </button>
                    </div>
                  ) : null}

                  {p === 'wordpress' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <p className="text-[11px] leading-relaxed text-muted">
                        {t('cnWpNote')}
                      </p>
                      <input
                        value={wpSite}
                        placeholder={t('cnSitePh')}
                        inputMode="url"
                        autoComplete="url"
                        aria-label={t('cnWpSiteAria')}
                        className="field !text-xs"
                      />
                      <input
                        value={wpUser}
                        onChange={(e) => setWpUser(e.target.value)}
                        placeholder={t('cnUsernamePh')}
                        autoComplete="username"
                        aria-label={t('cnWpUserAria')}
                        className="field !text-xs"
                      />
                      <input
                        value={wpPass}
                        onChange={(e) => setWpPass(e.target.value)}
                        placeholder={t('cnWpPassPh')}
                        type="password"
                        autoComplete="new-password"
                        aria-label={t('cnWpPassAria')}
                        className="field !text-xs"
                      />
                      {err ? (
                        <p className="rounded-xl bg-[#FDEBEC] px-3 py-2 text-[11px] font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                          {err}
                        </p>
                      ) : null}
                      <button type="button" onClick={connectWordPress} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                        {busy ? t('cnCheckingSite') : hasAny ? t('cnAddSite') : t('cnConnectWp')}
                      </button>
                    </div>
                  ) : null}

                  {p === 'telegram' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <p className="text-[11px] leading-relaxed text-muted">
                        {t('cnTgNote')}
                      </p>
                      <input
                        value={tgToken}
                        onChange={(e) => setTgToken(e.target.value)}
                        placeholder={t('cnTgTokenPh')}
                        aria-label={t('cnTgTokenAria')}
                        className="field !text-xs"
                      />
                      <input
                        value={tgChat}
                        onChange={(e) => setTgChat(e.target.value)}
                        placeholder={t('cnTgChatPh')}
                        aria-label={t('cnTgChatAria')}
                        className="field !text-xs"
                      />
                      {err ? (
                        <p className="rounded-xl bg-[#FDEBEC] px-3 py-2 text-[11px] font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                          {err}
                        </p>
                      ) : null}
                      <button type="button" onClick={connectTelegram} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                        {busy ? t('cnCheckingTg') : hasAny ? t('cnAddBot') : t('cnConnectTg')}
                      </button>
                    </div>
                  ) : null}

                  {p === 'facebook' && fbPick ? (
                    <div className="space-y-1.5 rounded-xl border border-accent bg-accent-soft/40 p-3">
                      <p className="text-xs font-bold">{t('cnPickFbPage')}</p>
                      <p className="-mt-1 text-[11px] text-muted">{t('cnFbPageNote')}</p>
                      {fbPick.map((pg) => (
                        <div
                          key={pg.id}
                          className={`flex items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-2 ${pg.missing ? 'opacity-60' : ''}`}
                        >
                          {pg.picture ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={pg.picture} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                          ) : (
                            <BrandIcon provider="facebook" className="h-8 w-8" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">{pg.name}</span>
                            {pg.missing ? (
                              <span className="block text-[11px] text-muted">{t('cnFbNoToken')}</span>
                            ) : pg.ig ? (
                              <span className="block truncate text-[11px] text-muted">{pg.ig} {t('cnOnInstagram')}</span>
                            ) : null}
                          </span>
                          {pg.missing ? null : (
                            <button
                              type="button"
                              onClick={() => pickPage(pg.id)}
                              disabled={picking !== null || !canManage}
                              className="btn btn-primary shrink-0 !px-3.5 !py-1.5 !text-xs"
                            >
                              {picking === pg.id ? t('cnConnecting') : t('cnConnect')}
                            </button>
                          )}
                        </div>
                      ))}
                      {fbOmitted > 0 ? (
                        <p className="text-[11px] text-muted">{fill(t('cnFbOmitted'), { n: fbOmitted })}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {p === 'gmb' && gmbPick ? (
                    <div className="space-y-1.5 rounded-xl border border-accent bg-accent-soft/40 p-3">
                      <p className="text-xs font-bold">{t('cnPickGmb')}</p>
                      <p className="-mt-1 text-[11px] text-muted">
                        {t('cnGmbNote')}
                      </p>
                      {gmbPick.map((l) => (
                        <div key={l.name} className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-2">
                          <BrandIcon provider="gmb" className="h-8 w-8" />
                          <span className="min-w-0 flex-1 truncate text-sm font-bold">{l.title}</span>
                          <button
                            type="button"
                            onClick={() => pickLocation(l.name)}
                            disabled={picking !== null || !canManage}
                            className="btn btn-primary shrink-0 !px-3.5 !py-1.5 !text-xs"
                          >
                            {picking === l.name ? t('cnConnecting') : t('cnConnect')}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {p === 'pinterest' && hasAny ? (
                    <PinBoardPicker
                      workspaceId={workspaceId}
                      channelId={list[0].id}
                      currentBoardId={typeof pinMd.pinBoardId === 'string' ? pinMd.pinBoardId : undefined}
                      currentBoardName={typeof pinMd.pinBoardName === 'string' ? pinMd.pinBoardName : undefined}
                      canManage={canManage}
                    />
                  ) : null}

                  {!manual ? (
                    soon ? (
                    <div className="rounded-xl bg-paper px-3 py-2.5">
                      <p className="text-center text-[11px] leading-relaxed text-muted">
                        {p === 'gmb'
                          ? t('cnGmbSoon')
                          : fill(t('cnInReview'), { label: providerLabel(p) })}
                      </p>
                    </div>
                    ) : canManage ? (
                    <div className="rounded-xl bg-paper px-3 py-2.5">
                      <a
                        href={startHref(p as OAuthProvider)}
                        target="_blank"
                        rel="noopener"
                        onClick={(e) => {
                          if (leaving) e.preventDefault();
                          else setLeaving(p);
                        }}
                        aria-disabled={leaving !== null}
                        className={`block text-center text-[13px] font-bold text-accent-ink ${leaving ? 'pointer-events-none opacity-50' : ''}`}
                      >
                        {leaving === p ? t('cnOpening') : hasAny ? fill(t('cnAddAnother'), { label }) : fill(t('cnConnectLabel'), { label })}
                      </a>
                      {hasAny ? (
                        <p className="mt-1 text-center text-[11px] leading-relaxed text-faint">
                          {fill(t('cnSwitchNote'), { label })}
                          {p === 'tiktok' ? t('cnTikTokNote') : null}
                        </p>
                      ) : null}
                    </div>
                    ) : !hasAny ? (
                      <p className="rounded-xl bg-paper px-3 py-2.5 text-center text-[11px] font-bold text-muted">{t('cnErrManage')}</p>
                    ) : null
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>
      </>
      )}
    </div>
  );
}
