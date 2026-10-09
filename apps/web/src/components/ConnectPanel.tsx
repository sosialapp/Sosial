'use client';

import { useEffect, useState } from 'react';
import IntegrationsTab from '@/components/IntegrationsTab';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { BrandIcon, type BrandProvider } from './BrandIcon';
import ChannelAvatar from './ChannelAvatar';
import { channelAvatar } from '@/lib/channelAvatar';
import DisconnectChannel from './DisconnectChannel';
import { OAUTH_PROVIDERS, oauthLabel, type OAuthProvider } from '@/lib/oauth';
import { canConnectProvider, type PlanKey } from '@/lib/billing/plans';
import type { ConnectedChannel } from '@/lib/types';

export interface FbPickPage {
  id: string;
  name: string;
  picture?: string;
  ig?: string;
}

export interface GmbPickLocation {
  name: string;
  title: string;
}

type ProviderId = OAuthProvider | 'bluesky' | 'telegram' | 'discord' | 'wordpress' | 'devto' | 'hashnode' | 'ghost' | 'vk';

const ORDER: ProviderId[] = [...OAUTH_PROVIDERS.map((p) => p.id), 'bluesky', 'telegram', 'discord', 'wordpress', 'devto', 'hashnode', 'ghost', 'vk'];

const MANUAL: Partial<Record<ProviderId, boolean>> = { bluesky: true, mastodon: true, telegram: true, discord: true, wordpress: true, devto: true, hashnode: true, ghost: true, vk: true };

/** Listed but not connectable yet — shows a Soon tag instead of Connect.
 *  gmb: allowlist pending. linkedin/pinterest: production approval pending
 *  (dev-mode connects still work via direct URL for testing). */
const COMING_SOON: ProviderId[] = ['gmb', 'linkedin', 'pinterest'];

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
 * provider's picker (Facebook Pages), and an "add another account" action —
 * the browser sends whichever account is signed in at the provider, so a
 * second account means switching the login there first.
 */
export default function ConnectPanel({
  workspaceId,
  channels,
  fbPick,
  gmbPick,
  status,
  canManage,
  plan,
}: {
  workspaceId: string;
  channels: ConnectedChannel[];
  /** Facebook Pages waiting for a pick (from ?connect=facebook). */
  fbPick: FbPickPage[] | null;
  /** GBP locations waiting for a pick (from ?connect=gmb). */
  gmbPick: GmbPickLocation[] | null;
  /** Result banners (from ?connected= / ?error=). */
  status: { connected?: string; already?: string; error?: string };
  /** Owners and admins — they see Remove/disconnect and every connect
   *  action. Ordinary members get a read-only list plus a note. */
  canManage: boolean;
  /** Workspace plan — paywalled providers (X) show an upgrade nudge on free. */
  plan: PlanKey;
}) {
  const [open, setOpen] = useState<ProviderId | null>(
    fbPick ? 'facebook' : gmbPick ? 'gmb' : null,
  );
  const [bskyHandle, setBskyHandle] = useState('');
  const [bskyPass, setBskyPass] = useState('');
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
      setErr('Only owners and admins can sync channels.');
      return;
    }
    setSyncing(true);
    setErr(null);
    setSyncedNote(null);
    try {
      const r = await fetch('/api/channels/sync', { method: 'POST' });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; queued_refresh?: number; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error ?? 'Sync failed.');
      setSyncedNote(
        `Checking ${j.queued_refresh ?? 0} channel(s) — statuses update shortly.`,
      );
      for (let i = 0; i < 5; i++) {
        await new Promise((res) => setTimeout(res, 5000));
        router.refresh();
      }
      setSyncedNote('Checked — statuses are up to date.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  /** A connect navigation is already in flight — swallow extra taps. */
  const [leaving, setLeaving] = useState<ProviderId | null>(null);
  const router = useRouter();

  // Consent happens in a new tab; this tab goes stale while the user is
  // away, so refresh the list whenever they come back to it. A return also
  // means any in-flight connect navigation was abandoned (cancelled in the
  // other tab) or completed elsewhere — either way the tap-lock must reset
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
      setErr('Only owners and admins can connect channels.');
      return;
    }
    if (!bskyHandle.trim()) {
      setErr('Enter your Bluesky handle first.');
      return;
    }
    if (!bskyPass) {
      setErr('Paste the app password too.');
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
      if (!j.ok) throw new Error(j.error ?? 'Bluesky login failed.');
      window.location.href = '/channels?connected=bluesky';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Bluesky login failed.');
    } finally {
      setBusy(false);
    }
  }

  async function connectMastodon() {
    setErr(null);
    if (!canManage) {
      setErr('Only owners and admins can connect channels.');
      return;
    }
    if (!mastodonInstance.trim()) {
      setErr('Type your username, or a server like fosstodon.org.');
      return;
    }
    setBusy(true);
    // Open the tab synchronously in the tap handler — awaiting the
    // registration first would trip popup blockers.
    const tab = window.open('about:blank', '_blank');
    try {
      const r = await fetch('/api/oauth/mastodon-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, instance: mastodonInstance.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!j.url) throw new Error(j.error ?? 'Could not register on that server.');
      if (tab) tab.location.href = j.url;
      else window.location.href = j.url;
    } catch (e) {
      try {
        tab?.close();
      } catch {
        /* already gone */
      }
      setErr(e instanceof Error ? e.message : 'Could not register on that server.');
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
      throw new Error((j as { error?: string }).error ?? 'Discord call failed.');
    }
    return j;
  }

  async function loadDcGuilds() {
    setErr(null);
    if (!canManage) {
      setErr('Only owners and admins can connect channels.');
      return;
    }
    if (!dcToken.trim()) {
      setErr('Paste the bot token from the Developer Portal first.');
      return;
    }
    setBusy(true);
    try {
      const j = await dcCall({});
      setDcGuilds(j.guilds ?? []);
      setDcGuild('');
      setDcChannels([]);
      setDcChannel('');
      if (!(j.guilds ?? []).length) setErr('That bot is in no servers — invite it first.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not reach Discord.');
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
      if (!(j.channels ?? []).length && !(j.threads ?? []).length) setErr('No text channels there — check the bot can see one.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not list channels.');
    } finally {
      setBusy(false);
    }
  }

  async function connectDiscord() {
    setErr(null);
    if (!canManage) {
      setErr('Only owners and admins can connect channels.');
      return;
    }
    if (!dcChannel) {
      setErr('Pick a channel first.');
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
      if (!j.ok) throw new Error(j.error ?? 'Could not connect Discord.');
      window.location.href = '/channels?connected=discord';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not connect Discord.');
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
      throw new Error((j as { error?: string }).error ?? 'Hashnode call failed.');
    }
    return j;
  }

  async function loadHnPubs() {
    setErr(null);
    if (!canManage) {
      setErr('Only owners and admins can connect channels.');
      return;
    }
    if (!hnToken.trim()) {
      setErr('Paste the personal access token first.');
      return;
    }
    setBusy(true);
    try {
      const j = await hnCall({});
      setHnPubs(j.publications ?? []);
      setHnPub('');
      if (!(j.publications ?? []).length) {
        setErr('No publications on that token — publish from a Hashnode account with a blog.');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not reach Hashnode.');
    } finally {
      setBusy(false);
    }
  }

  async function connectHashnode() {
    setErr(null);
    if (!canManage) {
      setErr('Only owners and admins can connect channels.');
      return;
    }
    if (!hnPub) {
      setErr('Pick a publication first.');
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
      if (!j.ok) throw new Error(j.error ?? 'Could not connect Hashnode.');
      window.location.href = '/channels?connected=hashnode';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not connect Hashnode.');
    } finally {
      setBusy(false);
    }
  }

  async function connectVk() {
    setErr(null);
    if (!canManage) {
      setErr('Only owners and admins can connect channels.');
      return;
    }
    if (!vkCommunity.trim()) {
      setErr('Enter the community link, short name or numeric id first.');
      return;
    }
    if (!vkKey) {
      setErr('Paste the community access key too.');
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
      if (!j.ok) throw new Error(j.error ?? 'Could not connect VK.');
      window.location.href = '/channels?connected=vk';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not connect VK.');
    } finally {
      setBusy(false);
    }
  }

  async function connectGhost() {    setErr(null);
    if (!canManage) {
      setErr('Only owners and admins can connect channels.');
      return;
    }
    if (!ghSite.trim()) {
      setErr('Enter your Ghost site URL first.');
      return;
    }
    if (!ghKey) {
      setErr('Paste the Admin API key too.');
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
      if (!j.ok) throw new Error(j.error ?? 'Could not connect Ghost.');
      window.location.href = '/channels?connected=ghost';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not connect Ghost.');
    } finally {
      setBusy(false);
    }
  }

  async function connectDevto() {
    setErr(null);
    if (!canManage) {
      setErr('Only owners and admins can connect channels.');
      return;
    }
    if (!devKey.trim()) {
      setErr('Paste the API key from dev.to → Settings → Extensions first.');
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
      if (!j.ok) throw new Error(j.error ?? 'Could not connect Dev.to.');
      window.location.href = '/channels?connected=devto';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not connect Dev.to.');
    } finally {
      setBusy(false);
    }
  }

  async function connectWordPress() {
    setErr(null);
    if (!canManage) {
      setErr('Only owners and admins can connect channels.');
      return;
    }
    if (!wpSite.trim()) {
      setErr('Enter your site URL first.');
      return;
    }
    if (!wpUser.trim()) {
      setErr('Enter the WordPress username.');
      return;
    }
    if (!wpPass) {
      setErr('Paste the application password too.');
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
      if (!j.ok) throw new Error(j.error ?? 'Could not connect WordPress.');
      window.location.href = '/channels?connected=wordpress';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not connect WordPress.');
    } finally {
      setBusy(false);
    }
  }

  async function connectTelegram() {    setErr(null);
    if (!canManage) {
      setErr('Only owners and admins can connect channels.');
      return;
    }
    if (!tgToken.trim()) {
      setErr('Paste the bot token from @BotFather first.');
      return;
    }
    if (!tgChat.trim()) {
      setErr('Enter the destination channel or group.');
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
      if (!j.ok) throw new Error(j.error ?? 'Could not connect Telegram.');
      window.location.href = '/channels?connected=telegram';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not connect Telegram.');
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
      if (!j.ok) throw new Error(j.error ?? 'Could not connect that Page.');
      window.location.href = '/channels?connected=facebook';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not connect that Page.');
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
      if (!j.ok) throw new Error(j.error ?? 'Could not connect that location.');
      window.location.href = '/channels?connected=gmb';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not connect that location.');
    } finally {
      setPicking(null);
    }
  }

  const subtitle = (p: ProviderId, list: ConnectedChannel[]): string => {    if (list.length === 0) {
      if (p === 'bluesky') return 'Handle + app password';
      if (p === 'mastodon') return 'Username + login';
      if (p === 'telegram') return 'Bot token + destination';
      if (p === 'discord') return 'Bot token + server';
      if (p === 'wordpress') return 'Site + app password';
      if (p === 'devto') return 'API key';
      if (p === 'hashnode') return 'Token + publication';
      if (p === 'ghost') return 'Site + Admin key';
      if (p === 'vk') return 'Community + access key';
      if (p === 'gmb') return 'Account + location';
      return 'Tap to connect';
    }
    if (list.length === 1) return accountName(list[0]);
    return `${list.length} accounts`;
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
          {connectedLabel} connected ✓
        </p>
      ) : null}
      {status.already ? (
        <p className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-xs font-bold text-accent-ink">
          {alreadyLabel} is already connected — nothing new added.
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

      <div className="flex gap-2" role="tablist" aria-label="Connect sections">
        {(['channels', 'integrations'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              tab === t ? 'bg-ink text-paper' : 'border border-line bg-card text-muted hover:text-ink'
            }`}
          >
            {t === 'channels' ? 'Channels' : 'Integrations'}
          </button>
        ))}
      </div>

      {tab === 'integrations' ? (
        <IntegrationsTab />
      ) : (
      <>
      <div className="mb-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search channels or accounts"
          aria-label="Search channels"
          className="field min-w-0 flex-1"
        />
        {canManage ? (
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing}
            className="shrink-0 rounded-full border border-line bg-card px-4 py-2 text-xs font-bold text-soft transition hover:bg-paper disabled:opacity-50"
          >
            {syncing ? 'Checking…' : 'Sync'}
          </button>
        ) : null}
      </div>
      {syncedNote ? (
        <p className="mb-3 rounded-xl bg-paper-dim px-3.5 py-2 text-xs font-bold text-muted">{syncedNote}</p>
      ) : null}
      <section aria-label="Connect accounts" className="overflow-hidden rounded-2xl border border-line bg-card">
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">
            No channels match “{query.trim()}”.
          </p>
        ) : null}
        {visible.map((p, pi) => {
          const list = byProvider(p);
          const hasAny = list.length > 0;
          const expanded = open === p;
          const manual = MANUAL[p] === true;
          const soon = COMING_SOON.includes(p);
          const label = providerLabel(p);

          const onRow = () => {
            // Coming soon: expand to the note, never start OAuth.
            if (soon) {
              setOpen(expanded ? null : p);
              return;
            }
            // Paywalled providers on free: explain instead of opening OAuth
            // (the server route enforces the same rule — this just says it first).
            if (!manual && !hasAny && !canConnectProvider(plan, p)) {
              setErr('X needs a paid plan — its posting API is paywalled. Upgrade in Billing to connect it.');
              return;
            }
            // No accounts yet on an OAuth provider: consent opens in a new
            // tab so this page keeps its place. Members can't start connects.
            if (!manual && !hasAny) {
              if (!canManage) {
                setErr('Only owners and admins can connect channels.');
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
                    {list.some((c) => c.status === 'expired') ? (
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
                  <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent-ink">Soon</span>
                ) : !canConnectProvider(plan, p) ? (
                  <span className="shrink-0 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-paper" title="Needs a paid plan">Pro</span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-accent-ink" title="Opens the provider's connect page in a new tab">
                    Connect
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
                        {c.status === 'expired' ? (
                          <span
                            className="flex shrink-0 items-center gap-1 rounded-full bg-[#FDF3D7] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#8a6100] dark:bg-[#2b2417] dark:text-[#e6a417]"
                            title={c.last_error ?? 'Reconnect this channel.'}
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            Reconnect
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
                          />
                        ) : null}
                      </div>
                      {c.status === 'expired' && c.last_error ? (
                        <p className="mt-1 truncate pl-[40px] pr-2 text-[11px] text-[#8a6100] dark:text-[#e6a417]" title={c.last_error}>
                          {c.last_error}
                        </p>
                      ) : null}
                    </div>
                  ))}

                  {p === 'bluesky' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <p className="text-[11px] leading-relaxed text-muted">
                        No OAuth needed — mint an app password at bsky.app → Settings → App passwords.
                      </p>
                      <input
                        value={bskyHandle}
                        onChange={(e) => setBskyHandle(e.target.value)}
                        placeholder="Handle (you.bsky.social)"
                        autoComplete="username"
                        aria-label="Bluesky handle"
                        className="field !text-xs"
                      />
                      <input
                        value={bskyPass}
                        onChange={(e) => setBskyPass(e.target.value)}
                        placeholder="App password (xxxx-xxxx-xxxx-xxxx)"
                        type="password"
                        autoComplete="new-password"
                        aria-label="Bluesky app password"
                        className="field !text-xs"
                      />
                      <button type="button" onClick={connectBsky} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                        {busy ? 'Connecting…' : hasAny ? 'Add this account' : 'Connect Bluesky'}
                      </button>
                    </div>
                  ) : null}
                  {p === 'mastodon' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <p className="text-[11px] leading-relaxed text-muted">
                        Your server registers Sosial itself — no app keys needed.
                      </p>
                      <input
                        value={mastodonInstance}
                        onChange={(e) => setMastodonInstance(e.target.value)}
                        placeholder="Username or server (fosstodon.org)"
                        autoComplete="username"
                        aria-label="Mastodon username or server"
                        className="field !text-xs"
                      />
                      <button type="button" onClick={connectMastodon} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                        {busy ? 'Registering…' : hasAny ? 'Add this account' : 'Connect Mastodon'}
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
                          → Bot → copy the token.
                        </li>
                        <li>Invite the bot to your server (Guild Install, Send Messages + Read Message History).</li>
                        <li>Paste the token below, list servers, pick a channel or thread, connect.</li>
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
                        placeholder="Bot token"
                        type="password"
                        autoComplete="new-password"
                        aria-label="Discord bot token"
                        className="field !text-xs"
                      />
                      {dcGuilds.length === 0 ? (
                        <button type="button" onClick={loadDcGuilds} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                          {busy ? 'Asking Discord…' : 'List my servers'}
                        </button>
                      ) : (
                        <>
                          <select
                            value={dcGuild}
                            onChange={(e) => loadDcChannels(e.target.value)}
                            aria-label="Discord server"
                            className="field !text-xs"
                          >
                            <option value="">Pick a server…</option>
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
                              aria-label="Discord channel"
                              className="field !text-xs"
                            >
                              <option value="">Pick a channel…</option>
                              {dcChannels.length > 0 ? (
                                <optgroup label="Channels">
                                  {dcChannels.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      #{c.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null}
                              {dcThreads.length > 0 ? (
                                <optgroup label="Threads">
                                  {dcThreads.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      #{t.parent_name || 'thread'} › {t.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null}
                            </select>
                          ) : null}
                          <button type="button" onClick={connectDiscord} disabled={busy || !dcChannel} className="btn btn-primary w-full !py-2 !text-xs">
                            {busy ? 'Connecting…' : hasAny ? 'Add this channel' : 'Connect Discord'}
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
                        No central login — each site issues its own key at Ghost Admin
                        → Settings → Integrations.
                      </p>
                      <input
                        value={ghSite}
                        onChange={(e) => setGhSite(e.target.value)}
                        placeholder="Site URL (https://example.com)"
                        inputMode="url"
                        autoComplete="url"
                        aria-label="Ghost site URL"
                        className="field !text-xs"
                      />
                      <input
                        value={ghKey}
                        onChange={(e) => setGhKey(e.target.value)}
                        placeholder="Admin API key (id:secret)"
                        type="password"
                        autoComplete="new-password"
                        aria-label="Ghost Admin API key"
                        className="field !text-xs"
                      />
                      {err ? (
                        <p className="rounded-xl bg-[#FDEBEC] px-3 py-2 text-[11px] font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                          {err}
                        </p>
                      ) : null}
                      <button type="button" onClick={connectGhost} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                        {busy ? 'Checking the site…' : hasAny ? 'Add another site' : 'Connect Ghost'}
                      </button>
                    </div>
                  ) : null}

                  {p === 'vk' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <p className="text-[11px] leading-relaxed text-muted">
                        Communities only — mint an access key at Community →
                        Manage → Working with API → Access Tokens (wall + photos
                        rights). Personal-profile posting is gated by VK.
                      </p>
                      <input
                        value={vkCommunity}
                        onChange={(e) => setVkCommunity(e.target.value)}
                        placeholder="vk.com/club123, short name or id"
                        autoComplete="url"
                        aria-label="VK community"
                        className="field !text-xs"
                      />
                      <input
                        value={vkKey}
                        onChange={(e) => setVkKey(e.target.value)}
                        placeholder="Community access key"
                        type="password"
                        autoComplete="new-password"
                        aria-label="VK community access key"
                        className="field !text-xs"
                      />
                      {err ? (
                        <p className="rounded-xl bg-[#FDEBEC] px-3 py-2 text-[11px] font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                          {err}
                        </p>
                      ) : null}
                      <button type="button" onClick={connectVk} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                        {busy ? 'Asking VK…' : hasAny ? 'Add another community' : 'Connect VK'}
                      </button>
                    </div>
                  ) : null}

                  {p === 'hashnode' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <p className="text-[11px] leading-relaxed text-muted">
                        No OAuth — generate a token at hashnode.com → Settings →
                        Developer, then pick the publication below.
                      </p>
                      <p className="rounded-lg bg-accent-soft px-2.5 py-1.5 text-[11px] font-bold leading-relaxed text-accent-ink">
                        Only Hashnode Pro publications can connect — upgrade at your blog dashboard → Billing first.
                      </p>
                      <input
                        value={hnToken}
                        onChange={(e) => {
                          setHnToken(e.target.value);
                          setHnPubs([]);
                          setHnPub('');
                        }}
                        placeholder="Personal access token"
                        type="password"
                        autoComplete="new-password"
                        aria-label="Hashnode personal access token"
                        className="field !text-xs"
                      />
                      {hnPubs.length === 0 ? (
                        <button type="button" onClick={loadHnPubs} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                          {busy ? 'Asking Hashnode…' : 'List my publications'}
                        </button>
                      ) : (
                        <>
                          <select
                            value={hnPub}
                            onChange={(e) => setHnPub(e.target.value)}
                            aria-label="Hashnode publication"
                            className="field !text-xs"
                          >
                            <option value="">Pick a publication…</option>
                            {hnPubs.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.title}
                              </option>
                            ))}
                          </select>
                          <button type="button" onClick={connectHashnode} disabled={busy || !hnPub} className="btn btn-primary w-full !py-2 !text-xs">
                            {busy ? 'Connecting…' : hasAny ? 'Add this publication' : 'Connect Hashnode'}
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
                        No OAuth — mint a key at dev.to → Settings → Extensions, then
                        paste it below.
                      </p>
                      <input
                        value={devKey}
                        onChange={(e) => setDevKey(e.target.value)}
                        placeholder="API key"
                        type="password"
                        autoComplete="new-password"
                        aria-label="Dev.to API key"
                        className="field !text-xs"
                      />
                      {err ? (
                        <p className="rounded-xl bg-[#FDEBEC] px-3 py-2 text-[11px] font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                          {err}
                        </p>
                      ) : null}
                      <button type="button" onClick={connectDevto} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                        {busy ? 'Checking with Dev.to…' : hasAny ? 'Add another account' : 'Connect Dev.to'}
                      </button>
                    </div>
                  ) : null}

                  {p === 'wordpress' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <p className="text-[11px] leading-relaxed text-muted">
                        No central login — each site mints its own password at Users →
                        Profile → Application Passwords (needs WP 5.6+).
                      </p>
                      <input
                        value={wpSite}
                        onChange={(e) => setWpSite(e.target.value)}
                        placeholder="Site URL (https://example.com)"
                        inputMode="url"
                        autoComplete="url"
                        aria-label="WordPress site URL"
                        className="field !text-xs"
                      />
                      <input
                        value={wpUser}
                        onChange={(e) => setWpUser(e.target.value)}
                        placeholder="Username"
                        autoComplete="username"
                        aria-label="WordPress username"
                        className="field !text-xs"
                      />
                      <input
                        value={wpPass}
                        onChange={(e) => setWpPass(e.target.value)}
                        placeholder="Application password (xxxx xxxx …)"
                        type="password"
                        autoComplete="new-password"
                        aria-label="WordPress application password"
                        className="field !text-xs"
                      />
                      {err ? (
                        <p className="rounded-xl bg-[#FDEBEC] px-3 py-2 text-[11px] font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                          {err}
                        </p>
                      ) : null}
                      <button type="button" onClick={connectWordPress} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                        {busy ? 'Checking the site…' : hasAny ? 'Add another site' : 'Connect WordPress'}
                      </button>
                    </div>
                  ) : null}

                  {p === 'telegram' ? (
                    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                      <p className="text-[11px] leading-relaxed text-muted">
                        No OAuth — message @BotFather for a bot token, add the bot to your
                        channel or group as an admin, then paste the destination below.
                      </p>
                      <input
                        value={tgToken}
                        onChange={(e) => setTgToken(e.target.value)}
                        placeholder="Bot token (123456:ABC-DEF…)"
                        type="password"
                        autoComplete="new-password"
                        aria-label="Telegram bot token"
                        className="field !text-xs"
                      />
                      <input
                        value={tgChat}
                        onChange={(e) => setTgChat(e.target.value)}
                        placeholder="Destination: @mychannel or -1001234567890"
                        aria-label="Telegram destination chat"
                        className="field !text-xs"
                      />
                      {err ? (
                        <p className="rounded-xl bg-[#FDEBEC] px-3 py-2 text-[11px] font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                          {err}
                        </p>
                      ) : null}
                      <button type="button" onClick={connectTelegram} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                        {busy ? 'Checking with Telegram…' : hasAny ? 'Add another bot' : 'Connect Telegram'}
                      </button>
                    </div>
                  ) : null}

                  {p === 'facebook' && fbPick ? (
                    <div className="space-y-1.5 rounded-xl border border-accent bg-accent-soft/40 p-3">
                      <p className="text-xs font-bold">Pick a Facebook Page</p>
                      <p className="-mt-1 text-[11px] text-muted">Publishing runs on the Page token.</p>
                      {fbPick.map((pg) => (
                        <div key={pg.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-2">
                          {pg.picture ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={pg.picture} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                          ) : (
                            <BrandIcon provider="facebook" className="h-8 w-8" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">{pg.name}</span>
                            {pg.ig ? <span className="block truncate text-[11px] text-muted">{pg.ig} on Instagram</span> : null}
                          </span>
                          <button
                            type="button"
                            onClick={() => pickPage(pg.id)}
                            disabled={picking !== null || !canManage}
                            className="btn btn-primary shrink-0 !px-3.5 !py-1.5 !text-xs"
                          >
                            {picking === pg.id ? 'Connecting…' : 'Connect'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {p === 'gmb' && gmbPick ? (
                    <div className="space-y-1.5 rounded-xl border border-accent bg-accent-soft/40 p-3">
                      <p className="text-xs font-bold">Pick a Business Profile location</p>
                      <p className="-mt-1 text-[11px] text-muted">
                        Each location connects separately — posts publish as local posts on it.
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
                            {picking === l.name ? 'Connecting…' : 'Connect'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {!manual ? (
                    soon ? (
                    <div className="rounded-xl bg-paper px-3 py-2.5">
                      <p className="text-center text-[11px] leading-relaxed text-muted">
                        {p === 'gmb'
                          ? 'Google Business is coming soon - Google still has to approve the API access. It will light up here the moment it does.'
                          : `${providerLabel(p)} is in review for production access - connecting is temporarily paused. It will light up here the moment approval lands.`}
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
                        {leaving === p ? 'Opening…' : hasAny ? `+ Add another ${label} account` : `Connect ${label}`}
                      </a>
                      {hasAny ? (
                        <p className="mt-1 text-center text-[11px] leading-relaxed text-faint">
                          The browser sends whichever {label} account is signed in there — switch the login
                          on {label} first to add a different one. A login page instead of permissions just
                          means signing in there once; after that Connect goes straight through.
                          {p === 'tiktok' ? ' TikTok always shows the consent page, so you can see exactly which account you are authorizing.' : null}
                        </p>
                      ) : null}
                    </div>
                    ) : !hasAny ? (
                      <p className="rounded-xl bg-paper px-3 py-2.5 text-center text-[11px] font-bold text-muted">
                        Only owners and admins can connect channels.
                      </p>
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
