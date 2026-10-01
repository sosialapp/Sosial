'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface WorkspaceOption {
  id: string;
  name: string;
  role: string;
}

/**
 * Masthead workspace switcher. Single-workspace users see a plain label
 * (no dropdown chrome); multi-workspace users get the list. Switching
 * sticks the sosial_ws cookie server-side, then refreshes the whole tree.
 */
export default function WorkspaceSwitcher({
  current,
  workspaces,
}: {
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open ]);

  if (workspaces.length < 2) {
    return (
      <p className="min-w-0 flex-1 truncate font-display text-sm font-extrabold">{current.name}</p>
    );
  }

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

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full min-w-0 items-center gap-1 truncate text-left"
      >
        <span className="min-w-0 flex-1 truncate font-display text-sm font-extrabold">
          {busy ? 'Switching…' : current.name}
        </span>
        <span aria-hidden="true" className="shrink-0 text-[10px] text-faint">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute top-full left-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-card shadow-[0_16px_50px_rgba(28,26,20,0.25)]"
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
        </ul>
      ) : null}
    </div>
  );
}
