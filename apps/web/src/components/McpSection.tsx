'use client';

/**
 * MCP section (Team → AI & Developer): what MCP is, the clients that can
 * drive this workspace, the server URL to paste into one, and a permission
 * checklist used when minting a scoped key. Reuses the /api/keys surface, an
 * MCP key IS a workspace API key with scopes; the delete scope is opt-in and
 * off by default (least privilege).
 *
 * Layout is a two-step rail: 1) add the server URL to the client, 2) pick
 * permissions (grouped Read / Write, switches, the risky one in red) and
 * mint the key, which then replaces step 2 until dismissed.
 */
import { useState } from 'react';
import {
  ArrowUpRight, Bot, Check, Copy, Eye, KeyRound, Link2, PencilLine, ScrollText, ShieldCheck, TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { AiMark } from '@/components/SourceMarks';
import { docsUrl } from '@/lib/site';

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
  { scope: 'comments:read', label: 'Read comments on your posts', hint: 'See what people replied', default: true },
  { scope: 'posts:write', label: 'Create & edit drafts', hint: 'Draft and revise posts', default: true },
  { scope: 'posts:schedule', label: 'Schedule & unschedule posts', hint: 'Queue and pull from the calendar', default: true },
  { scope: 'comments:write', label: 'Reply to comments', hint: 'Answer people as your channel', default: true },
  { scope: 'posts:delete', label: 'Delete posts', hint: 'Permanently remove published posts', default: false },
];

/** Reassurances shown under the server URL, as small chips. */
const GUARANTEES: { icon: LucideIcon; text: string }[] = [
  { icon: ShieldCheck, text: 'Same checks as the app' },
  { icon: TriangleAlert, text: 'Deletes need typed confirmation' },
  { icon: ScrollText, text: 'Every call is logged' },
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

  const reads = PERMISSIONS.filter((p) => p.scope.endsWith(':read'));
  const writes = PERMISSIONS.filter((p) => !p.scope.endsWith(':read'));

  const permRow = (p: (typeof PERMISSIONS)[number]) => {
    const on = !!checked[p.scope];
    const risky = !p.default;
    return (
      <button
        key={p.scope}
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => toggle(p.scope)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-surface"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-bold leading-tight">{p.label}</span>
            {risky ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FDEBEC] px-1.5 py-px text-[10px] font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
                <TriangleAlert className="h-2.5 w-2.5" aria-hidden="true" />
                Risky
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-muted">{p.hint}</span>
        </span>
        {/* iOS-style switch; red when a risky permission is on. */}
        <span
          aria-hidden="true"
          className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
            on ? (risky ? 'bg-[#E5484D]' : 'bg-[#12914A]') : 'bg-line'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200 ${
              on ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </span>
      </button>
    );
  };

  return (
    <section className="card mt-4 overflow-hidden" aria-label="AI and developer, MCP">
      {/* Header: what this is, and which assistants can use it. */}
      <div className="px-5 pt-5 pb-4 sm:px-6">
        <div className="flex flex-wrap items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-bone">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-extrabold tracking-tight">Connect an AI assistant</h2>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                MCP
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              Let an assistant draft, schedule and check this workspace&apos;s posts for you. It goes through the same
              checks as the app.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-faint">Works with</span>
          <span className="flex flex-wrap items-center gap-1">
            {CLIENTS.map((c) => (
              <span
                key={c.id}
                title={c.label}
                aria-label={c.label}
                className="grid h-8 w-8 place-items-center rounded-full border border-line bg-card text-ink"
              >
                <AiMark id={c.id} className="h-4 w-4 [&_svg]:h-full [&_svg]:w-full" />
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* Two steps on a rail: connect, then authorise. */}
      <ol className="border-t border-line px-5 py-5 sm:px-6">
        <li className="relative flex gap-4 pb-7">
          <span className="absolute top-8 bottom-0 left-[13px] w-px bg-line" aria-hidden="true" />
          <StepDot n={1} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[15px] font-extrabold tracking-tight">Add the server to your assistant</h3>
            <p className="mt-0.5 text-xs text-muted">Paste this as the server URL in your AI client&apos;s connector settings.</p>
            <div className="mt-3 flex max-w-xl items-center gap-2 rounded-2xl border border-line bg-surface py-1.5 pr-1.5 pl-3.5">
              <Link2 className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
              <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{SERVER_URL}</code>
              <button
                type="button"
                onClick={() => void copy(SERVER_URL, 'url')}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-card px-3 text-xs font-bold text-ink shadow-[0_1px_2px_rgba(28,26,20,0.08)] ring-1 ring-line transition hover:bg-paper"
              >
                {copied === 'url' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                {copied === 'url' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {GUARANTEES.map((g) => (
                <span key={g.text} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-soft">
                  <g.icon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                  {g.text}
                </span>
              ))}
            </div>
            <a
              href={`${docsUrl()}/mcp`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-ink underline-offset-2 hover:underline"
            >
              Step-by-step setup guide
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </li>

        <li className="relative flex gap-4">
          <StepDot n={2} done={!!freshKey} />
          <div className="min-w-0 flex-1">
            {freshKey ? (
              <>
                <h3 className="font-display text-[15px] font-extrabold tracking-tight">Your key is ready</h3>
                <p className="mt-0.5 text-xs text-muted">
                  Paste it into your assistant as the Bearer token. It&apos;s shown only this once.
                </p>
                <div className="mt-3 max-w-xl rounded-2xl border border-[#12914A]/40 bg-[#EDF3EC] p-3 dark:bg-[#1c2b21]">
                  <code className="block break-all font-mono text-[13px] text-ink">{freshKey}</code>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => void copy(freshKey, 'key')} className="btn btn-primary btn-sm">
                      {copied === 'key' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                      {copied === 'key' ? 'Copied' : 'Copy key'}
                    </button>
                    <button type="button" onClick={() => setFreshKey(null)} className="btn btn-ghost btn-sm">
                      Done
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-[15px] font-extrabold tracking-tight">Choose what it can do, then create a key</h3>
                  <span className="text-[11px] font-bold text-faint">
                    {activeScopes} of {PERMISSIONS.length} allowed
                  </span>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="overflow-hidden rounded-2xl border border-line">
                    <p className="flex items-center gap-1.5 border-b border-line bg-surface/60 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted">
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      Read
                    </p>
                    <div className="divide-y divide-line-soft">{reads.map(permRow)}</div>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-line">
                    <p className="flex items-center gap-1.5 border-b border-line bg-surface/60 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted">
                      <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                      Write
                    </p>
                    <div className="divide-y divide-line-soft">{writes.map(permRow)}</div>
                  </div>
                </div>
                <div className="mt-4 flex max-w-xl flex-col gap-2 sm:flex-row">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name it, e.g. Claude on my laptop"
                    maxLength={60}
                    className="field flex-1"
                    aria-label="New MCP client name"
                  />
                  <button type="button" onClick={create} disabled={busy} className="btn btn-primary shrink-0 justify-center">
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    {busy ? 'Creating…' : 'Create MCP key'}
                  </button>
                </div>
              </>
            )}
          </div>
        </li>
      </ol>

      {err ? (
        <p className="border-t border-line px-5 py-3 text-sm font-bold text-[#9F2F2D] sm:px-6 dark:text-[#f2a8a8]">{err}</p>
      ) : null}
    </section>
  );
}

/** Numbered dot on the step rail; a check once the step is done. */
function StepDot({ n, done = false }: { n: number; done?: boolean }) {
  return (
    <span
      className={`relative z-[1] grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold ring-4 ring-card ${
        done ? 'bg-[#12914A] text-white' : 'bg-ink text-bone'
      }`}
      aria-hidden="true"
    >
      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
    </span>
  );
}
