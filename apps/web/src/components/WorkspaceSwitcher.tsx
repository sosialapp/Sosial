'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export interface WorkspaceOption {
  id: string;
  name: string;
  role: string;
  avatar_url?: string | null;
}

/** Avatar dot: team picture when set, initial letter otherwise. */
function TeamDot({ url, name, size }: { url?: string; name: string; size: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pics, setPics] = useState<Record<string, string>>({});
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open ]);

  /** Signed URLs for workspace pictures (private bucket, members can read). */
  useEffect(() => {
    if (!open) return;
    let dead = false;
    (async () => {
      const sb = createClient();
      const next: Record<string, string> = {};
      await Promise.all(
        workspaces.map(async (w) => {
          if (!w.avatar_url) return;
          try {
            const { data } = await sb.storage.from('avatars').createSignedUrl(w.avatar_url!.split('?')[0], 3600);
            if (data?.signedUrl) next[w.id] = data.signedUrl;
          } catch { /* initial-letter fallback */ }
        }),
      );
      if (!dead && Object.keys(next).length > 0) setPics((prev) => ({ ...prev, ...next }));
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Current team ${current.name}, open team switcher`}
        className="flex h-9 max-w-[190px] shrink-0 items-center gap-1.5 rounded-full border border-line bg-card py-1 pl-1.5 pr-2 transition hover:shadow-[0_2px_8px_rgba(28,26,20,0.12)]"
      >
        <TeamDot url={pics[current.id]} name={current.name} size={24} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">
          {busy ? 'Switching…' : current.name}
        </span>
        <span aria-hidden="true" className="shrink-0 text-[10px] text-faint">
          {open ? '▲' : '▼'}
        </span>
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
                <TeamDot url={pics[w.id]} name={w.name} size={26} />
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
