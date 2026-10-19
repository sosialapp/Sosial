'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { prefetchSignedUrls, useSignedUrl } from '@/lib/useSignedUrl';
import { useSwitchTransition } from './SwitchTransition';

export interface WorkspaceOption {
  id: string;
  name: string;
  role: string;
  avatar_url?: string | null;
}

/** Avatar dot: team picture when set, initial letter otherwise. */
function TeamDot({ path, name, size }: { path?: string | null; name: string; size: number }) {
  // Signing happens here (not only when the menu opens) so the current team's
  // picture is present on first paint. A missing file still yields a URL, so a
  // dead picture 500s at fetch time; fall back to the initial letter.
  const url = useSignedUrl(path, 'avatars', 3600);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
        className="shrink-0 rounded-full border border-line object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-ink font-display font-extrabold text-paper"
    >
      {(name || 'T')[0].toUpperCase()}
    </span>
  );
}

/**
 * Masthead workspace switcher. The dropdown lists every team the user
 * belongs to; "+ Create team" hands off to the team page (plan limits are
 * enforced by the DB's WORKSPACE_LIMIT trigger and surfaced there).
 * Switching sticks the sosial_ws cookie server-side, then refreshes the
 * whole tree.
 */
export default function WorkspaceSwitcher({
  current,
  workspaces,
}: {
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
}) {
  const router = useRouter();
  const { refresh, cancel } = useSwitchTransition();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Once the server confirms the new team, the label is authoritative again —
  // clear the optimistic name and re-arm the switcher (busy otherwise stuck on).
  useEffect(() => {
    setBusy(false);
    setPending(null);
  }, [current.id]);

  // Sign every team's picture up front (one batched request) so opening the
  // menu shows the faces instantly rather than flashing initial letters.
  useEffect(() => {
    prefetchSignedUrls(workspaces.map((w) => w.avatar_url));
  }, [workspaces]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open ]);

  const pick = async (id: string) => {
    if (busy) return;
    if (id === current.id) {
      // Clicking the current team manages it.
      setOpen(false);
      router.push('/team');
      return;
    }
    setBusy(true);
    setPending(workspaces.find((w) => w.id === id)?.name ?? null);
    setOpen(false);
    try {
      const res = await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspace_id: id }),
      });
      if (!res.ok) throw new Error('switch failed');
      refresh();
    } catch {
      cancel();
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Current team ${current.name}, open team switcher`}
        className="flex h-9 max-w-[190px] shrink-0 items-center gap-1.5 rounded-full border border-line bg-card py-1 pl-1.5 pr-2 transition hover:shadow-[0_2px_8px_rgba(28,26,20,0.12)]"
      >
        <TeamDot path={current.avatar_url} name={current.name} size={24} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">
          {busy && pending ? pending : current.name}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute top-full right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-card shadow-[0_16px_50px_rgba(28,26,20,0.25)]"
        >
          {workspaces.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                role="option"
                aria-selected={w.id === current.id}
                onClick={() => pick(w.id)}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition hover:bg-paper ${
                  w.id === current.id ? 'font-extrabold' : ''
                }`}
              >
                <TeamDot path={w.avatar_url} name={w.name} size={26} />
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
