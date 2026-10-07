'use client';

/**
 * MCP section (Team → AI & Developer): what MCP is, the server URL to paste
 * into an AI client, and a permission checklist used when minting a scoped
 * key. Reuses the /api/keys surface — an MCP key IS a workspace API key with
 * scopes; the delete scope is opt-in and off by default (least privilege).
 */
import { useState } from 'react';

const SERVER_URL = 'https://sosial.app/api/mcp';

const PERMISSIONS: { scope: string; label: string; default: boolean }[] = [
  { scope: 'posts:read', label: 'View posts & schedule', default: true },
  { scope: 'channels:read', label: 'View connected channels', default: true },
  { scope: 'media:read', label: 'View uploaded media', default: true },
  { scope: 'posts:write', label: 'Create & edit drafts', default: true },
  { scope: 'posts:schedule', label: 'Schedule & unschedule posts', default: true },
  { scope: 'posts:delete', label: 'Delete posts', default: false },
];

export default function McpSection({ canManage }: { canManage: boolean }) {
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(PERMISSIONS.map((p) => [p.scope, p.default])),
  );
  const [name, setName] = useState('');
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<'url' | 'key' | null>(null);

  if (!canManage) return null;

  const toggle = (scope: string) => setChecked((c) => ({ ...c, [scope]: !c[scope] }));

  const copy = async (text: string, what: 'url' | 'key') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setErr('Copy failed — select the text manually.');
    }
  };

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const scopes = PERMISSIONS.filter((p) => checked[p.scope]).map((p) => p.scope);
      if (scopes.length === 0) throw new Error('Pick at least one permission.');
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'MCP client', scopes }),
      });
      const j = (await res.json()) as { key?: string; error?: string };
      if (!res.ok || !j.key) throw new Error(j.error ?? 'Could not create the key.');
      setFreshKey(j.key);
      setName('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the key.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card mt-4 p-5" aria-label="AI and developer — MCP">
      <h2 className="font-display text-base font-extrabold tracking-tight">AI &amp; Developer — MCP</h2>
      <p className="mt-1 text-sm text-muted">
        Connect AI assistants (Claude, Cursor, or any MCP client) to create, schedule and
        inspect this workspace&apos;s posts. Every action runs through the same checks as the
        app, destructive actions need a typed confirmation, and every call is logged.
      </p>

      <div className="mt-4 rounded-2xl border border-line bg-surface p-3">
        <p className="text-xs font-bold text-soft">Server URL</p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-ink px-2.5 py-1.5 font-mono text-xs text-paper">
            {SERVER_URL}
          </code>
          <button type="button" onClick={() => void copy(SERVER_URL, 'url')} className="btn btn-ghost !px-3 !py-1.5 !text-xs">
            {copied === 'url' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          Authenticate with a scoped key (below) as a Bearer token. Docs:{' '}
          <a href="https://sosial.app/developers#mcp" className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">
            sosial.app/developers
          </a>
        </p>
      </div>

      {freshKey ? (
        <div className="mt-4 rounded-2xl border border-line bg-card p-4">
          <p className="text-sm font-bold">Copy this key now — it will never be shown again.</p>
          <code className="mt-2 block break-all rounded-xl bg-ink px-3 py-2 font-mono text-sm text-paper">
            {freshKey}
          </code>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void copy(freshKey, 'key')} className="btn btn-ghost">
              {copied === 'key' ? 'Copied' : 'Copy key'}
            </button>
            <button type="button" onClick={() => setFreshKey(null)} className="btn">
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-faint">Permissions for the new client</p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {PERMISSIONS.map((p) => (
              <label key={p.scope} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!checked[p.scope]}
                  onChange={() => toggle(p.scope)}
                  className="h-4 w-4 accent-[#FFC62E]"
                />
                <span className="min-w-0 flex-1 font-medium">{p.label}</span>
                {!p.default ? <span className="text-[10px] font-bold text-faint">risky</span> : null}
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name, e.g. Claude"
              maxLength={60}
              className="field flex-1"
              aria-label="New MCP client name"
            />
            <button type="button" onClick={create} disabled={busy} className="btn btn-primary">
              {busy ? 'Creating…' : 'Create MCP key'}
            </button>
          </div>
        </>
      )}

      {err ? <p className="mt-3 text-sm font-bold text-red-600">{err}</p> : null}
    </section>
  );
}
