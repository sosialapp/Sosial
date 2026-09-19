'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/calendar', label: 'Calendar', glyph: '▦' },
  { href: '/queue', label: 'Queue', glyph: '≣' },
  { href: '/composer', label: 'Composer', glyph: '✎' },
  { href: '/channels', label: 'Channels', glyph: '◉' },
];

export default function Sidebar({ workspaceName, email }: { workspaceName: string; email: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-card">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-lg font-extrabold text-white">
          S
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-extrabold">{workspaceName}</p>
          <p className="truncate text-xs text-muted">{email}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {LINKS.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active ? 'bg-accent text-white' : 'text-soft hover:bg-bone'
              }`}
            >
              <span className="w-4 text-center">{l.glyph}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <Link
          href="/composer"
          className="btn btn-primary w-full"
        >
          + New post
        </Link>
      </div>

      <form action="/auth/signout" method="post" className="border-t border-line p-3">
        <button className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-muted hover:bg-bone" type="submit">
          Sign out
        </button>
      </form>
    </aside>
  );
}
