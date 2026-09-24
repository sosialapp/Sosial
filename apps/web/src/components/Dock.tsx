'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
  CalendarDays,
  ChartColumn,
  CircleUserRound,
  Home,
  LayoutGrid,
  Lightbulb,
  LogOut,
  Plus,
} from 'lucide-react';
import SendIcon from '@/components/SendIcon';

type DockItem = {
  href?: string;
  label: string;
  match: (pathname: string) => boolean;
  icon: React.ReactNode;
  /** Pastel icon colour — icons only; selection stays yellowish. */
  tint?: string;
  hero?: boolean;
  popup?: boolean;
};

const ITEMS: DockItem[] = [
  {
    href: '/dashboard',
    label: 'Home',
    match: (p) => p === '/dashboard' || p === '/queue' || p.startsWith('/dashboard/'),
    tint: '#6C9BF5',
    icon: <Home className="h-6 w-6" aria-hidden="true" />,
  },
  {
    href: '/calendar',
    label: 'Calendar',
    match: (p) => p === '/calendar' || p.startsWith('/calendar/'),
    tint: '#F0924E',
    icon: <CalendarDays className="h-6 w-6" aria-hidden="true" />,
  },
  {
    href: '/post',
    label: 'Post',
    match: (p) => p === '/post' || p === '/create' || p === '/new' || p === '/composer' || p.startsWith('/post/') || p.startsWith('/create/') || p.startsWith('/new/') || p.startsWith('/composer/'),
    tint: '#4CAF7D',
    icon: <SendIcon className="h-6 w-6" />,
  },
  {
    label: 'New post',
    match: () => false,
    hero: true,
    popup: true,
    icon: <Plus className="h-6 w-6" strokeWidth={2.2} aria-hidden="true" />,
  },
  {
    href: '/analytics',
    label: 'Analytics',
    match: (p) => p === '/analytics' || p.startsWith('/analytics/'),
    tint: '#9B7EDE',
    icon: <ChartColumn className="h-6 w-6" aria-hidden="true" />,
  },
  {
    href: '/profile',
    label: 'Profile',
    match: (p) => p === '/profile' || p === '/channels' || p.startsWith('/profile/') || p.startsWith('/channels/'),
    tint: '#E87EA1',
    icon: <CircleUserRound className="h-6 w-6" aria-hidden="true" />,
  },
];

const PLUS_OPTIONS = [
  {
    href: '/post?tab=post',
    label: 'Post',
    desc: 'Write and schedule',
    icon: <SendIcon className="h-4 w-4" />,
  },
  {
    href: '/post?tab=ideas',
    label: 'Ideas',
    desc: 'Capture it first',
    icon: <Lightbulb className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: '/post?tab=templates',
    label: 'From template',
    desc: 'Start from a starter',
    icon: <LayoutGrid className="h-4 w-4" aria-hidden="true" />,
  },
];

/**
 * Left rail nav: home, calendar, create, quick-add +, analytics, profile.
 * Icons lift to the right on hover (discrete per-item mouseenter, no
 * cursor tracking). The + menu opens to the right of the rail.
 */
export default function Dock() {
  const pathname = usePathname();
  const dockRef = useRef<HTMLDivElement>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const closePlus = () => setPlusOpen(false);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.from(dock, { x: -24, autoAlpha: 0, duration: 0.55, ease: 'power3.out' });

    const items = Array.from(dock.querySelectorAll<HTMLElement>('[data-dock-item]'));
    const icons = items.map((el) => el.querySelector<HTMLElement>('[data-dock-icon]')).filter((el): el is HTMLElement => !!el);
    if (!items.length || !icons.length) return;
    gsap.set(icons, { transformOrigin: '50% 50%' });

    const reset = () =>
      gsap.to(icons, { duration: 0.4, x: 0, scale: 1, ease: 'power3.out', overwrite: 'auto' });

    const removers: (() => void)[] = [];
    items.forEach((item, i) => {
      const enter = () => {
        icons.forEach((icon, j) => {
          const d = Math.abs(i - j);
          gsap.to(icon, {
            duration: 0.32,
            x: d === 0 ? 8 : d === 1 ? 4 : 0,
            scale: d === 0 ? 1.14 : d === 1 ? 1.06 : 1,
            ease: 'back.out(2)',
            overwrite: 'auto',
          });
        });
      };
      item.addEventListener('mouseenter', enter);
      removers.push(() => item.removeEventListener('mouseenter', enter));
    });
    dock.addEventListener('mouseleave', reset);
    return () => {
      removers.forEach((fn) => fn());
      dock.removeEventListener('mouseleave', reset);
    };
  }, []);

  useEffect(() => {
    if (!plusOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePlus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [plusOpen]);

  useEffect(() => {
    closePlus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <nav aria-label="Primary" className="pointer-events-none fixed inset-y-0 left-0 z-40 flex items-center pl-3">
      {plusOpen ? (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={closePlus}
          className="pointer-events-auto fixed inset-0 cursor-default"
        />
      ) : null}
      <div
        ref={dockRef}
        className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-3xl border border-line bg-card/90 px-2.5 py-3 shadow-[0_18px_50px_-16px_rgba(25,21,18,0.45)] backdrop-blur-xl"
      >
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          const tile = (
            <>
              {/* Tooltip pins to the right of the rail so the lift can never cover it. */}
              <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#191512] px-2.5 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {item.label}
              </span>
              <span
                data-dock-icon
                className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors duration-150 ${
                  item.hero ? 'bg-accent text-ink shadow-[0_8px_20px_-8px_rgba(255,198,46,0.8)]' : ''
                } ${
                  item.hero
                    ? 'opacity-100'
                    : active
                      ? 'bg-accent-soft opacity-100'
                      : 'opacity-100 group-hover:bg-paper-dim'
                }`}
                style={item.hero || !item.tint ? undefined : { color: item.tint }}
              >
                {item.icon}
              </span>
            </>
          );
          if (item.popup) {
            return (
              <div key={item.label} data-dock-item className="group relative">
                <button
                  type="button"
                  onClick={() => setPlusOpen((v) => !v)}
                  aria-label={item.label}
                  aria-haspopup="menu"
                  aria-expanded={plusOpen}
                  className="group block"
                >
                  {tile}
                </button>
                {plusOpen ? (
                  <div
                    role="menu"
                    aria-label="Quick create"
                    className="absolute left-full top-0 z-30 ml-4 w-60 rounded-2xl border border-line bg-card p-1.5 text-left shadow-[0_24px_60px_-16px_rgba(25,21,18,0.45)]"
                  >
                    {PLUS_OPTIONS.map((o) => (
                      <Link
                        key={o.href}
                        href={o.href}
                        role="menuitem"
                        onClick={closePlus}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-bone dark:hover:bg-white/5"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper-dim text-ink">
                          {o.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">{o.label}</span>
                          <span className="block truncate text-xs text-muted">{o.desc}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }
          return (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href!}
              data-dock-item
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className="group relative block"
            >
              {tile}
            </Link>
          );
        })}
        <SignOutItem onOpen={closePlus} />
      </div>
    </nav>
  );
}

/** Sign-out tile pinned under Profile — asks first, then POSTs to /auth/signout. */
function SignOutItem({ onOpen }: { onOpen: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmOpen]);

  function signOut() {
    if (busy) return;
    setBusy(true);
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/auth/signout';
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <div data-dock-item className="group relative">
      {confirmOpen ? (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setConfirmOpen(false)}
          className="pointer-events-auto fixed inset-0 z-20 cursor-default"
        />
      ) : null}
      <button
        type="button"
        onClick={() => {
          if (!confirmOpen) onOpen();
          setConfirmOpen((v) => !v);
        }}
        aria-label="Sign out"
        aria-expanded={confirmOpen}
        className="group relative z-30 block"
      >
        <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#191512] px-2.5 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          Sign out
        </span>
        <span
          data-dock-icon
          className="flex h-11 w-11 items-center justify-center rounded-2xl opacity-100 transition-colors duration-150 group-hover:bg-paper-dim"
          style={{ color: '#E0655F' }}
        >
          <LogOut className="h-6 w-6" aria-hidden="true" />
        </span>
      </button>
      {confirmOpen ? (
        <div
          role="alertdialog"
          aria-label="Confirm sign out"
          aria-describedby="dock-signout-desc"
          className="absolute left-full top-0 z-30 ml-4 w-60 rounded-2xl border border-line bg-card p-4 text-left shadow-[0_24px_60px_-16px_rgba(25,21,18,0.45)]"
        >
          <p className="text-sm font-bold">Sign out of Sosial?</p>
          <p id="dock-signout-desc" className="mt-1 text-xs leading-relaxed text-muted">
            You will need to sign back in to post or schedule.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setConfirmOpen(false)} className="btn btn-ghost flex-1 !py-2 !text-xs">
              Cancel
            </button>
            <button
              type="button"
              onClick={signOut}
              disabled={busy}
              className="btn btn-primary flex-1 !py-2 !text-xs"
            >
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
