'use client';

import { useState } from 'react';
import { BrandIcon, type BrandProvider } from './BrandIcon';
import { OAUTH_PROVIDERS, oauthLabel } from '@/lib/oauth';

export interface FbPickPage {
  id: string;
  name: string;
  picture?: string;
  ig?: string;
}

/**
 * Web account connect — one row per OAuth provider (consent in a full
 * redirect, exchange + import server-side) plus the Bluesky handle/password
 * form and the Facebook Page picker. Replaces the old "mobile app only"
 * guide; Threads/Mastodon/Pinterest still connect from the phone.
 */
export default function ConnectPanel({
  workspaceId,
  connected,
  fbPick,
  status,
}: {
  workspaceId: string;
  /** Providers with at least one live channel — shown as done, not offered. */
  connected: string[];
  /** Facebook Pages waiting for a pick (from ?connect=facebook). */
  fbPick: FbPickPage[] | null;
  /** Result banners (from ?connected= / ?error=). */
  status: { connected?: string; error?: string };
}) {
  const [bskyOpen, setBskyOpen] = useState(false);
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);

  async function connectBsky() {
    setErr(null);
    if (!handle.trim()) {
      setErr('Enter your Bluesky handle first.');
      return;
    }
    if (!appPassword) {
      setErr('Paste the app password too.');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/oauth/bluesky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, handle: handle.trim(), app_password: appPassword }),
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

      {fbPick ? (
        <section aria-label="Pick a Facebook Page" className="rounded-2xl border border-accent bg-accent-soft/40 p-4">
          <p className="font-display text-sm font-extrabold tracking-tight">Pick a Facebook Page</p>
          <p className="mt-0.5 text-xs text-muted">Publishing runs on the Page token, so choose which Page to connect.</p>
          <div className="mt-2.5 space-y-1.5">
            {fbPick.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-2">
                {p.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.picture} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <BrandIcon provider="facebook" className="h-8 w-8" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{p.name}</span>
                  {p.ig ? <span className="block truncate text-[11px] text-muted">{p.ig} on Instagram</span> : null}
                </span>
                <button
                  type="button"
                  onClick={() => pickPage(p.id)}
                  disabled={picking !== null}
                  className="btn btn-primary shrink-0 !px-3.5 !py-1.5 !text-xs"
                >
                  {picking === p.id ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-label="Connect accounts" className="rounded-2xl border border-line bg-card p-4">
        <p className="font-display text-sm font-extrabold tracking-tight">Connect accounts</p>
        <p className="mt-0.5 text-xs text-muted">Sign in with each network — tokens stay in the server vault.</p>
        <div className="mt-2.5 space-y-1.5">
          {OAUTH_PROVIDERS.map((p) => {
            const done = connected.includes(p.id);
            return (
              <div key={p.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1">
                <BrandIcon provider={p.id as BrandProvider} className="h-8 w-8" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.label}</span>
                {done ? (
                  <span className="rounded-full bg-[#EDF3EC] px-2.5 py-1 text-[11px] font-extrabold text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]">
                    Connected ✓
                  </span>
                ) : (
                  <a
                    href={`/api/oauth/start?provider=${p.id}&workspace_id=${encodeURIComponent(workspaceId)}`}
                    className="btn btn-ghost shrink-0 !px-3.5 !py-1.5 !text-xs"
                  >
                    Connect
                  </a>
                )}
              </div>
            );
          })}
          <div className="rounded-xl px-1 py-1">
            <div className="flex items-center gap-2.5">
              <BrandIcon provider="bluesky" className="h-8 w-8" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">Bluesky</span>
              {connected.includes('bluesky') ? (
                <span className="rounded-full bg-[#EDF3EC] px-2.5 py-1 text-[11px] font-extrabold text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]">
                  Connected ✓
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setBskyOpen((v) => !v)}
                  aria-expanded={bskyOpen}
                  className="btn btn-ghost shrink-0 !px-3.5 !py-1.5 !text-xs"
                >
                  {bskyOpen ? 'Close' : 'Connect'}
                </button>
              )}
            </div>
            {bskyOpen && !connected.includes('bluesky') ? (
              <div className="mt-2 space-y-2 rounded-xl border border-line bg-paper p-3">
                <p className="text-[11px] leading-relaxed text-muted">
                  No OAuth needed — mint an app password at bsky.app → Settings → App passwords.
                </p>
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="Handle (you.bsky.social)"
                  autoComplete="username"
                  aria-label="Bluesky handle"
                  className="field !text-xs"
                />
                <input
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder="App password (xxxx-xxxx-xxxx-xxxx)"
                  type="password"
                  autoComplete="new-password"
                  aria-label="Bluesky app password"
                  className="field !text-xs"
                />
                <button type="button" onClick={connectBsky} disabled={busy} className="btn btn-primary w-full !py-2 !text-xs">
                  {busy ? 'Connecting…' : 'Connect Bluesky'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-2.5 border-t border-line-soft pt-2.5 text-[11px] leading-relaxed text-faint">
          Threads, Mastodon and Pinterest still connect from the mobile app.
        </p>
      </section>
    </div>
  );
}
