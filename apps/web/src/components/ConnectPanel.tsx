'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { BrandIcon, type BrandProvider } from './BrandIcon';
import ChannelAvatar, { channelAvatar } from './ChannelAvatar';
import DisconnectChannel from './DisconnectChannel';
import { OAUTH_PROVIDERS, oauthLabel, type OAuthProvider } from '@/lib/oauth';
import type { ConnectedChannel } from '@/lib/types';

export interface FbPickPage {
  id: string;
  name: string;
  picture?: string;
  ig?: string;
}

type ProviderId = OAuthProvider | 'bluesky' | 'telegram' | 'discord';

const ORDER: ProviderId[] = [...OAUTH_PROVIDERS.map((p) => p.id), 'bluesky', 'telegram', 'discord'];

const MANUAL: Partial<Record<ProviderId, boolean>> = { bluesky: true, mastodon: true, telegram: true, discord: true };

function providerLabel(p: ProviderId): string {
  if (p === 'bluesky') return 'Bluesky';
  if (p === 'telegram') return 'Telegram';
  if (p === 'discord') return 'Discord';
  return oauthLabel(p);
}

function accountName(c: ConnectedChannel): string {
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
  status,
  canManage,
}: {
  workspaceId: string;
  channels: ConnectedChannel[];
  /** Facebook Pages waiting for a pick (from ?connect=facebook). */
  fbPick: FbPickPage[] | null;
  /** Result banners (from ?connected= / ?error=). */
  status: { connected?: string; already?: string; error?: string };
  /** Owners and admins — they see Remove/disconnect and every connect
   *  action. Ordinary members get a read-only list plus a note. */
  canManage: boolean;
}) {
  const [open, setOpen] = useState<ProviderId | null>(fbPick ? 'facebook' : null);
  const [bskyHandle, setBskyHandle] = useState('');
  const [bskyPass, setBskyPass] = useState('');
  const [mastodonInstance, setMastodonInstance] = useState('');
  const [tgToken, setTgToken] = useState('');
  const [tgChat, setTgChat] = useState('');
  const [dcToken, setDcToken] = useState('');
  const [dcGuilds, setDcGuilds] = useState<{ id: string; name: string }[]>([]);
  const [dcGuild, setDcGuild] = useState('');
  const [dcChannels, setDcChannels] = useState<{ id: string; name: string }[]>([]);
  const [dcChannel, setDcChannel] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  /** A connect navigation is already in flight — swallow extra taps. */
  const [leaving, setLeaving] = useState<ProviderId | null>(null);
  const router = useRouter();

  // Consent happens in a new tab; this tab goes stale while the user is
  // away, so refresh the list whenever they come back to it.
  useEffect(() => {
    const refresh = () => router.refresh();
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
  const ordered: ProviderId[] = [...ORDER].sort(
    (a, b) => Number(byProvider(b).length > 0) - Number(byProvider(a).length > 0),
  );
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

  type DcList = { guilds?: { id: string; name: string }[]; channels?: { id: string; name: string }[]; error?: string };

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
    setDcChannel('');
    if (!guildId) return;
    setBusy(true);
    try {
      const j = await dcCall({ guild_id: guildId });
      setDcChannels(j.channels ?? []);
      if (!(j.channels ?? []).length) setErr('No text channels there — check the bot can see one.');
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

  const subtitle = (p: ProviderId, list: ConnectedChannel[]): string => {    if (list.length === 0) {
      if (p === 'bluesky') return 'Handle + app password';
      if (p === 'mastodon') return 'Username + login';
      if (p === 'telegram') return 'Bot token + destination';
      if (p === 'discord') return 'Bot token + server';
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

      <div className="mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search channels or accounts"
          aria-label="Search channels"
          className="field"
        />
      </div>
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
          const label = providerLabel(p);

          const onRow = () => {
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
                  <span className="block text-sm font-extrabold tracking-tight">{label}</span>
                  <span className="block truncate text-xs text-muted">{subtitle(p, list)}</span>
                </span>
                {hasAny || manual ? (
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 text-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
                  />
                ) : (
                  <span className="shrink-0 text-[13px] font-bold text-accent-ink">Connect</span>
                )}
              </button>

              {expanded ? (
                <div className="space-y-2 px-4 pb-4">
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
                      <p className="text-[11px] leading-relaxed text-muted">
                        No OAuth — create an app in the Developer Portal, enable the bot,
                        invite it to your server, then paste the token.
                      </p>
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
                          {dcChannels.length > 0 ? (
                            <select
                              value={dcChannel}
                              onChange={(e) => setDcChannel(e.target.value)}
                              aria-label="Discord channel"
                              className="field !text-xs"
                            >
                              <option value="">Pick a channel…</option>
                              {dcChannels.map((c) => (
                                <option key={c.id} value={c.id}>
                                  #{c.name}
                                </option>
                              ))}
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

                  {list.map((c) => (
                    <div key={c.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1">
                      <ChannelAvatar
                        provider={c.provider}
                        avatar={channelAvatar(c.metadata)}
                        size={30}
                        badge={list.length > 1}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{accountName(c)}</span>
                      <span
                        aria-label={c.status}
                        title={c.status}
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[c.status] ?? 'bg-surface'}`}
                      />
                      {canManage ? (
                        <DisconnectChannel
                          workspaceId={workspaceId}
                          provider={c.provider}
                          externalId={c.external_id}
                        />
                      ) : null}
                    </div>
                  ))}

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

                  {!manual ? (
                    canManage ? (
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
    </div>
  );
}
