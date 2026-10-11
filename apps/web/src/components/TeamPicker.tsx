'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkspaceOption } from './WorkspaceSwitcher';

/**
 * Team-page picker: "{name} · N members ⌄". Switching and creating both
 * live behind the chevron menu so the page itself never advertises
 * team-creation. Creating sticks the sosial_ws cookie server-side for the
 * new workspace and refreshes the whole tree.
 */
export default function TeamPicker({
  current,
  memberCount,
  workspaces,
}: {
  current: WorkspaceOption;
  memberCount: number;
  workspaces: WorkspaceOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setErr(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open ]);

  const pick = async (id: string) => {
    if (id === current.id || busy) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspace_id: id }),
      });
      if (!res.ok) throw new Error('switch failed');
      setOpen(false);
      router.refresh();
    } catch {
      setBusy(false);
      setOpen(false);
    }
  };

  const create = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/workspace/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? 'Could not create the team.');
        return;
      }
      setOpen(false);
      setCreating(false);
      setName('');
      router.refresh();
    } catch {
      setErr('Network error — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={box} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="mt-1 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink"
      >
        <span>
          {busy ? 'Switching…' : current.name} · {memberCount} member
          {memberCount === 1 ? '' : 's'}
        </span>
        <span aria-hidden="true" className="text-[10px] text-faint">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute top-full left-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-card shadow-[0_16px_50px_rgba(28,26,20,0.25)]"
        >
          {workspaces.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                role="option"
                aria-selected={w.id === current.id}
                onClick={() => pick(w.id)}
                className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-paper ${
                  w.id === current.id ? 'font-extrabold' : ''
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
                <span className="shrink-0 text-[11px] text-faint capitalize">{w.role}</span>
              </button>
            </li>
          ))}
          <li className="border-t border-line-soft">
            {creating ? (
              <div className="space-y-2 p-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') create();
                    if (e.key === 'Escape') setCreating(false);
                  }}
                  autoFocus
                  placeholder="Team name"
                  className="field !py-1.5 text-sm"
                  aria-label="New team name"
                />
                {err ? <p className="text-[11px] font-semibold text-[#9F2F2D]">{err}</p> : null}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={create}
                    disabled={busy || !name.trim()}
                    className="flex-1 rounded-lg bg-ink px-2 py-1.5 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    {busy ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setErr(null);
                    }}
                    className="rounded-lg bg-paper px-2 py-1.5 text-xs font-bold text-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full px-4 py-2.5 text-left text-sm font-bold text-soft transition hover:bg-paper"
              >
                + Create team
              </button>
            )}
          </li>
        </ul>
      ) : null}
    </div>
  );
}
