'use client';

import { useCallback, useEffect, useState } from 'react';

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
 * the plaintext once, revoke. The hashes never leave the server.
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
      setError('Copy failed — select the key manually.');
    }
  };

  return (
    <section className="card mt-4 p-5" aria-label="API keys">
      <h2 className="font-display text-base font-extrabold tracking-tight">API keys</h2>
      <p className="mt-1 text-sm text-muted">
        Keys let Zapier, Make or your own code create posts in this workspace. A key posts
        with owner permissions — keep it secret.
      </p>

      {freshKey ? (
        <div className="mt-4 rounded-2xl border border-line bg-card p-4">
          <p className="text-sm font-bold">
            Copy this key now — it will never be shown again.
          </p>
          <code className="mt-2 block break-all rounded-xl bg-ink px-3 py-2 font-mono text-sm text-paper">
            {freshKey}
          </code>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={copy} className="btn btn-ghost">
              {copied ? 'Copied' : 'Copy key'}
            </button>
            <button type="button" onClick={() => setFreshKey(null)} className="btn">
              Done
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name, e.g. Zapier"
          maxLength={60}
          className="field flex-1"
          aria-label="New key name"
        />
        <button type="button" onClick={create} disabled={busy} className="btn btn-primary">
          {busy ? 'Creating…' : 'Create key'}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}

      <ul className="mt-4 space-y-2">
        {keys.map((k) => (
          <li
            key={k.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {k.name}{' '}
                <span className="font-mono font-normal text-faint">{k.key_prefix}…</span>
              </p>
              <p className="text-xs text-faint">
                {k.revoked_at
                  ? 'Revoked'
                  : k.last_used_at
                    ? `Last used ${new Date(k.last_used_at).toLocaleString()}`
                    : 'Never used'}
              </p>
            </div>
            {!k.revoked_at ? (
              <button type="button" onClick={() => revoke(k.id)} className="btn btn-ghost">
                Revoke
              </button>
            ) : null}
          </li>
        ))}
        {keys.length === 0 ? (
          <li className="text-sm text-faint">No keys yet — create one to connect Zapier.</li>
        ) : null}
      </ul>
    </section>
  );
}
