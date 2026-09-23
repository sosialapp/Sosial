'use client';

import { useState } from 'react';
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

type ProviderId = OAuthProvider | 'bluesky';

const ORDER: ProviderId[] = [...OAUTH_PROVIDERS.map((p) => p.id), 'bluesky'];

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
  status: { connected?: string; error?: string };
  /** Owner/admin — only they see Remove. */
  canManage: boolean;
}) {
  const [open, setOpen] = useState<ProviderId | null>(fbPick ? 'facebook' : null);
  const [bskyHandle, setBskyHandle] = useState('');
  const [bskyPass, setBskyPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);

  const byProvider = (p: string): ConnectedChannel[] => channels.filter((c) => c.provider === p);
  const ordered: ProviderId[] = [...ORDER].sort(
    (a, b) => Number(byProvider(b).length > 0) - Number(byProvider(a).length > 0),
  );

  const startHref = (p: OAuthProvider): string =>
    `/api/oauth/start?provider=${p}&workspace_id=${encodeURIComponent(workspaceId)}`;

  async function connectBsky() {
    setErr(null);
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
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'Bluesky login failed.');
      window.location.href = '/channels?connected=bluesky';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Bluesky login failed.');
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
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'Could not connect that Page.');
      window.location.href = '/channels?connected=facebook';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not connect that Page.');
    } finally {
      setPicking(null);
    }
  }

  const subtitle = (p: ProviderId, list: ConnectedChannel[]): string => {
    if (list.length === 0) return p === 'bluesky' ? 'Handle + app password' : 'Tap to connect';
    if (list.length === 1) return accountName(list[0]);
    return `${list.length} accounts`;
  };

  return (
    <div className="space-y-3">
      {status.connected ? (
        <p className="rounded-xl bg-[#EDF3EC] px-3.5 py-2.5 text-xs font-bold text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]">
          {oauthLabel(status.connected)} connected ✓
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

      <section aria-label="Connect accounts" className="overflow-hidden rounded-2xl border border-line bg-card">
        {ordered.map((p, pi) => {
          const list = byProvider(p);
          const hasAny = list.length > 0;
          const expanded = open === p;
          const manual = p === 'bluesky';
          const label = p === 'bluesky' ? 'Bluesky' : oauthLabel(p);

          const onRow = () => {
            // No accounts yet on an OAuth provider: go straight to consent.
            if (!manual && !hasAny) {
              window.location.href = startHref(p as OAuthProvider);
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
                  <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-faint transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m4.5 7.5 5.5 6 5.5-6" />
                  </svg>
                ) : (
                  <span className="shrink-0 text-[13px] font-bold text-accent-ink">Connect</span>
                )}
              </button>

              {expanded ? (
                <div className="space-y-2 px-4 pb-4">
                  {manual ? (
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
                            disabled={picking !== null}
                            className="btn btn-primary shrink-0 !px-3.5 !py-1.5 !text-xs"
                          >
                            {picking === pg.id ? 'Connecting…' : 'Connect'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {!manual ? (
                    <div className="rounded-xl bg-paper px-3 py-2.5">
                      <a
                        href={startHref(p as OAuthProvider)}
                        className="block text-center text-[13px] font-bold text-accent-ink"
                      >
                        {hasAny ? `+ Add another ${label} account` : `Connect ${label}`}
                      </a>
                      {hasAny ? (
                        <p className="mt-1 text-center text-[11px] leading-relaxed text-faint">
                          The browser sends whichever {label} account is signed in there — switch the login
                          on {label} first to add a different one. A login page instead of permissions just
                          means signing in there once; after that Connect goes straight through.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <p className="px-1 text-[11px] leading-relaxed text-faint">
        Threads, Mastodon and Pinterest still connect from the mobile app.
      </p>
    </div>
  );
}
