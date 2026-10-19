'use client';

/**
 * MCP section (Team → AI & Developer): what MCP is, the clients that can
 * drive this workspace, the server URL to paste into one, and a permission
 * checklist used when minting a scoped key. Reuses the /api/keys surface, an
 * MCP key IS a workspace API key with scopes; the delete scope is opt-in and
 * off by default (least privilege).
 *
 * Layout is a two-step flow: 1) point the client at the server, 2) grant
 * scopes and mint the key. Both live in one card so the mental model stays
 * "connect, then authorise".
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import { AiMark } from '@/components/SourceMarks';

const SERVER_URL = 'https://sosial.app/api/mcp';

/** AI clients that speak MCP; marks come from SourceMarks' AI_MARKS. */
const CLIENTS: { id: string; label: string }[] = [
  { id: 'claude', label: 'Claude' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'copilot', label: 'Copilot' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'codex', label: 'Codex' },
  { id: 'muse', label: 'Muse' },
  { id: 'openclaw', label: 'OpenClaw' },
  { id: 'hermes', label: 'Hermes' },
];

const PERMISSIONS: { scope: string; label: string; hint: string; default: boolean }[] = [
  { scope: 'posts:read', label: 'View posts & schedule', hint: 'Read the queue and calendar', default: true },
  { scope: 'channels:read', label: 'View connected channels', hint: 'See which accounts exist', default: true },
  { scope: 'media:read', label: 'View uploaded media', hint: 'Browse the media library', default: true },
  { scope: 'posts:write', label: 'Create & edit drafts', hint: 'Draft and revise posts', default: true },
  { scope: 'posts:schedule', label: 'Schedule & unschedule posts', hint: 'Queue and pull from the calendar', default: true },
  { scope: 'posts:delete', label: 'Delete posts', hint: 'Permanently remove published posts', default: false },
];

/** Reassurances shown under the server URL, one per line. */
const GUARANTEES = [
  'Actions run through the same checks as the app.',
  'Destructive actions need a typed confirmation.',
  'Every call is logged to this workspace.',
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
  const activeScopes = PERMISSIONS.filter((p) => checked[p.scope]).length;

  const copy = async (text: string, what: 'url' | 'key') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setErr('Copy failed, select the text manually.');
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
    <section className="card mt-4 overflow-hidden" aria-label="AI and developer, MCP">
      {/* ------------------------------- header ------------------------------ */}
      <div className="border-b border-line bg-surface px-5 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="eyebrow">AI &amp; Developer</p>
            <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight">
              Operate this workspace from your AI client
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Connect an AI assistant over MCP and it can draft, schedule and inspect
              this workspace&apos;s posts, running through the same checks as the app.
            </p>
          </div>
          <span className="pill hidden shrink-0 border border-line bg-card text-soft sm:inline-flex">
            Remote MCP server
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {CLIENTS.map((c) => (
            <span
              key={c.id}
              title={`${c.label}, via MCP`}
              className="flex items-center gap-1.5 rounded-full border border-line bg-card py-1 pl-1.5 pr-2.5 text-xs font-bold text-soft"
            >
              <AiMark id={c.id} className="h-4 w-4 shrink-0 [&_svg]:h-full [&_svg]:w-full" />
              {c.label}
            </span>
          ))}
        </div>
      </div>

      {/* -------------------------------- body ------------------------------- */}
      <div className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[1fr_1.05fr]">
        {/* Step 1 — server URL */}
        <div className="flex flex-col rounded-2xl border border-line bg-surface p-5">
          <StepHead n={1} title="Point your client at this server" />

          <div className="mt-4 flex items-stretch gap-2">
            <code className="flex min-w-0 flex-1 items-center rounded-xl bg-ink px-3 py-2.5 font-mono text-xs text-paper">
              <span className="truncate">{SERVER_URL}</span>
            </code>
            <button
              type="button"
              onClick={() => void copy(SERVER_URL, 'url')}
              className="btn btn-ghost shrink-0 !px-3.5 !py-1.5 !text-xs"
            >
              {copied === 'url' ? 'Copied' : 'Copy'}
            </button>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted">
            Paste this in as the server URL, then authenticate with the scoped key
            you create on the right. Full setup guide:{' '}
            <a
              href="https://sosial.app/developers#mcp"
              className="font-bold text-ink underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              sosial.app/developers
            </a>
          </p>

          <ul className="mt-4 space-y-2 border-t border-line-soft pt-4 text-xs text-muted">
            {GUARANTEES.map((g) => (
              <li key={g} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bolt-deep" aria-hidden="true" />
                <span className="leading-relaxed">{g}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Step 2 — permissions + key, or the freshly minted key */}
        {freshKey ? (
          <div className="flex flex-col rounded-2xl border border-line bg-card p-5">
            <StepHead n={2} title="Key created" tone="success" />
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Copy it now and paste it into your client as the Bearer token. This is the
              only time it will ever be shown.
            </p>
            <code className="mt-3 block break-all rounded-xl bg-ink px-3 py-2.5 font-mono text-xs text-paper">
              {freshKey}
            </code>
            <div className="mt-auto flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => void copy(freshKey, 'key')}
                className="btn btn-primary !py-1.5 !text-xs"
              >
                {copied === 'key' ? 'Copied' : 'Copy key'}
              </button>
              <button
                type="button"
                onClick={() => setFreshKey(null)}
                className="btn btn-ghost !py-1.5 !text-xs"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col rounded-2xl border border-line bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <StepHead n={2} title="Grant permissions" />
              <span className="shrink-0 text-[11px] font-bold text-faint">
                {activeScopes} of {PERMISSIONS.length} on
              </span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {PERMISSIONS.map((p) => {
                const on = !!checked[p.scope];
                return (
                  <button
                    key={p.scope}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggle(p.scope)}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      on ? 'border-line bg-paper' : 'border-line-soft bg-transparent hover:bg-paper'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`relative mt-0.5 inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full transition-colors ${
                        on ? 'bg-ink' : 'bg-line'
                      }`}
                    >
                      <span
                        className={`inline-block h-[14px] w-[14px] rounded-full bg-paper shadow-sm transition-transform ${
                          on ? 'translate-x-[16px]' : 'translate-x-[2px]'
                        }`}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold leading-tight">{p.label}</span>
                        {!p.default ? (
                          <span className="rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-bold text-accent-ink">
                            risky
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-faint">{p.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Client name, e.g. Claude"
                maxLength={60}
                className="field flex-1"
                aria-label="New MCP client name"
              />
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className="btn btn-primary shrink-0"
              >
                {busy ? 'Creating…' : 'Create MCP key'}
              </button>
            </div>
          </div>
        )}
      </div>

      {err ? (
        <p className="border-t border-line px-5 py-3 text-sm font-bold text-red-600 sm:px-6">{err}</p>
      ) : null}
    </section>
  );
}

/** Numbered step marker + title, shared by both panels. */
function StepHead({
  n,
  title,
  tone = 'default',
}: {
  n: number;
  title: string;
  tone?: 'default' | 'success';
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          tone === 'success' ? 'bg-bolt text-on-accent' : 'bg-ink text-paper'
        }`}
        aria-hidden="true"
      >
        {tone === 'success' ? '✓' : n}
      </span>
      <h3 className="font-display text-sm font-extrabold tracking-tight">{title}</h3>
    </div>
  );
}
