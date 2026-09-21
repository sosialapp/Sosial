'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

const LINKS = [
  {
    href: '/calendar',
    label: 'Calendar',
    icon: (
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden="true">
        <rect x="3" y="4.5" width="14" height="12" rx="2.5" />
        <path d="M3 8.5h14M7 2.8v3M13 2.8v3" />
      </svg>
    ),
  },
  {
    href: '/queue',
    label: 'Queue',
    icon: (
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden="true">
        <path d="M3 5.5h14M3 10h14M3 14.5h9" />
        <circle cx="16" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: '/composer',
    label: 'Composer',
    icon: (
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13.5 3.5 16.5 6.5 7 16l-4 1 1-4L13.5 3.5Z" />
      </svg>
    ),
  },
  {
    href: '/channels',
    label: 'Channels',
    icon: (
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <rect x="3" y="3" width="6" height="6" rx="1.8" />
        <rect x="11" y="3" width="6" height="6" rx="1.8" />
        <rect x="3" y="11" width="6" height="6" rx="1.8" />
        <rect x="11" y="11" width="6" height="6" rx="1.8" />
      </svg>
    ),
  },
];

function NavLinks({ onGo, pathname }: { onGo?: () => void; pathname: string }) {
  return (
    <nav className="flex-1 space-y-1 px-3" aria-label="Dashboard">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onGo}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
              active ? 'bg-zest text-ink' : 'text-soft hover:bg-bone dark:hover:bg-white/5'
            }`}
          >
            {l.icon}
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ workspaceName, email }: { workspaceName: string; email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open ]);

  useEffect(() => {
    close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line bg-card px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-soft"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <path d="M3 5.5h14M3 10h14M3 14.5h14" />
          </svg>
        </button>
        <Image src="/bolt.png" alt="" width={24} height={24} aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate font-display text-sm font-extrabold">{workspaceName}</p>
        <ThemeToggle />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-card lg:flex">
        <div className="flex items-center gap-2.5 px-5 pb-2 pt-5">
          <Image src="/bolt.png" alt="Sosial" width={30} height={30} />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-extrabold">Sosial</p>
            <p className="truncate text-xs text-muted">{workspaceName}</p>
          </div>
        </div>
        <p className="truncate px-5 pb-4 text-xs text-faint">{email}</p>

        <NavLinks pathname={pathname} />

        <div className="space-y-2 px-3 pb-3">
          <Link href="/composer" className="btn w-full bg-zest font-bold text-ink hover:brightness-95">
            + New post
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action="/auth/signout" method="post" className="min-w-0 flex-1">
              <button
                className="w-full truncate rounded-xl px-3 py-2 text-left text-sm font-semibold text-muted transition hover:bg-bone dark:hover:bg-white/5"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-card">
            <div className="flex items-center gap-2.5 px-5 pb-2 pt-5">
              <Image src="/bolt.png" alt="Sosial" width={30} height={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-extrabold">Sosial</p>
                <p className="truncate text-xs text-muted">{workspaceName}</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-soft"
              >
                ✕
              </button>
            </div>
            <p className="truncate px-5 pb-4 text-xs text-faint">{email}</p>

            <NavLinks pathname={pathname} onGo={close} />

            <div className="mt-auto space-y-2 border-t border-line p-3">
              <Link href="/composer" onClick={close} className="btn w-full bg-zest font-bold text-ink hover:brightness-95">
                + New post
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-muted hover:bg-bone dark:hover:bg-white/5"
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
