'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Plus, Webhook } from 'lucide-react';

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

/**
 * Workspace API keys (owner/admin only): mint keys for Zapier/Make, show
 * the plaintext once, revoke. The hashes never leave the server. Active keys
 * list first with a used / never-used dot; revoked keys sit faded below.
 */
export default function ApiKeysManager({ canManage }: { canManage: boolean }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState('');
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/keys');
      const j = (await res.json()) as { keys?: ApiKeyRow[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? 'Could not load keys.');
      setKeys(j.keys ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load keys.');
    }
  }, []);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  if (!canManage) return null;

  const create = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Zapier' }),
      });
      const j = (await res.json()) as { key?: string; error?: string };
      if (!res.ok || !j.key) throw new Error(j.error ?? 'Could not create the key.');
      setFreshKey(j.key);
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the key.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm('Revoke this key? Connected automations will stop working.')) return;
    setError(null);
    try {
      const res = await fetch('/api/keys', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? 'Could not revoke the key.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke the key.');
    }
  };

  const copy = async () => {
    if (!freshKey) return;
    try {
      await navigator.clipboard.writeText(freshKey);
      setCopied(true);
    } catch {
      setError('Copy failed, select the key manually.');
    }
  };

  const active = keys.filter((k) => !k.revoked_at);
  const revoked = keys.filter((k) => k.revoked_at);

  const ago = (iso: string): string => {
    const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const keyRow = (k: ApiKeyRow) => {
    const off = !!k.revoked_at;
    return (
      <li key={k.id} className={`flex items-center gap-3 px-4 py-3 ${off ? 'opacity-60' : ''}`}>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${off ? 'bg-surface text-faint' : 'bg-accent-soft text-ink'}`}>
          <KeyRound className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-sm font-bold">{k.name}</span>
            <code className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted">{k.key_prefix}…</code>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${off ? 'bg-faint' : k.last_used_at ? 'bg-[#12914A]' : 'bg-[#F2A400]'}`} aria-hidden="true" />
            {off
              ? `Revoked ${ago(k.revoked_at as string)}`
              : k.last_used_at
                ? `Last used ${ago(k.last_used_at)}`
                : `Never used · created ${ago(k.created_at)}`}
          </span>
        </span>
        {!off ? (
          <button
            type="button"
            onClick={() => revoke(k.id)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-[#9F2F2D] transition hover:bg-[#FDEBEC] dark:text-[#f2a8a8] dark:hover:bg-[#2c1b1b]"
          >
            Revoke
          </button>
        ) : null}
      </li>
    );
  };

  return (
    <section className="card mt-4 overflow-hidden" aria-label="API keys">
      <div className="flex flex-wrap items-start gap-3.5 px-5 pt-5 pb-4 sm:px-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface text-ink">
          <Webhook className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-extrabold tracking-tight">API keys</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            Let Zapier, Make or your own code create posts here. Keys post with owner permissions, so keep them secret.
          </p>
        </div>
      </div>

      <div className="px-5 pb-4 sm:px-6">
        {freshKey ? (
          <div className="rounded-2xl border border-[#12914A]/40 bg-[#EDF3EC] p-3.5 dark:bg-[#1c2b21]">
            <p className="flex items-center gap-1.5 text-sm font-bold text-[#346538] dark:text-[#8fd0a0]">
              <Check className="h-4 w-4" aria-hidden="true" />
              Key created. Copy it now, it won&apos;t be shown again.
            </p>
            <code className="mt-2 block break-all rounded-xl bg-card px-3 py-2 font-mono text-[13px] text-ink ring-1 ring-line">
              {freshKey}
            </code>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={copy} className="btn btn-primary btn-sm">
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy key'}
              </button>
              <button type="button" onClick={() => setFreshKey(null)} className="btn btn-ghost btn-sm">
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="flex max-w-xl flex-col gap-2 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name it, e.g. Zapier"
              maxLength={60}
              className="field flex-1"
              aria-label="New key name"
            />
            <button type="button" onClick={create} disabled={busy} className="btn btn-primary shrink-0 justify-center">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {busy ? 'Creating…' : 'Create key'}
            </button>
          </div>
        )}
        {error ? <p className="mt-3 text-sm font-bold text-[#9F2F2D] dark:text-[#f2a8a8]">{error}</p> : null}
      </div>

      <div className="border-t border-line">
        {keys.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted sm:px-6">No keys yet. Create one to connect Zapier or Make.</p>
        ) : (
          <>
            <p className="flex items-center justify-between bg-surface/60 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-muted">
              <span>Active · {active.length}</span>
              {revoked.length ? <span className="normal-case tracking-normal text-faint">{revoked.length} revoked</span> : null}
            </p>
            <ul className="divide-y divide-line-soft">
              {active.map(keyRow)}
              {revoked.map(keyRow)}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
