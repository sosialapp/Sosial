'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

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

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const ITEMS: DockItem[] = [
  {
    href: '/dashboard',
    label: 'Home',
    match: (p) => p === '/dashboard' || p === '/queue' || p.startsWith('/dashboard/'),
    tint: '#6C9BF5',
    icon: (
      <svg viewBox="0 0 20 20" className="h-6 w-6" {...STROKE} aria-hidden="true">
        <path d="M3.5 9.2 10 3.5l6.5 5.7" />
        <path d="M5.2 8.5V16a.8.8 0 0 0 .8.8h8a.8.8 0 0 0 .8-.8V8.5" />
        <path d="M8.2 16.8v-4.2h3.6v4.2" />
      </svg>
    ),
  },
  {
    href: '/calendar',
    label: 'Calendar',
    match: (p) => p === '/calendar' || p.startsWith('/calendar/'),
    tint: '#F0924E',
    icon: (
      <svg viewBox="0 0 20 20" className="h-6 w-6" {...STROKE} aria-hidden="true">
        <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
        <path d="M3 8.5h14" />
        <path d="M7 2.8v3M13 2.8v3" />
      </svg>
    ),
  },
  {
    href: '/create',
    label: 'Create',
    match: (p) => p === '/create' || p === '/new' || p === '/composer' || p.startsWith('/create/') || p.startsWith('/new/') || p.startsWith('/composer/'),
    tint: '#4CAF7D',
    icon: (
      <svg viewBox="0 0 20 20" className="h-6 w-6" {...STROKE} aria-hidden="true">
        <path d="M13.5 3.5 16.5 6.5 7 16l-4 1 1-4L13.5 3.5Z" />
      </svg>
    ),
  },
  {
    label: 'New post',
    match: () => false,
    hero: true,
    popup: true,
    icon: (
      <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
        <path d="M10 3.5v13M3.5 10h13" />
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    match: (p) => p === '/analytics' || p.startsWith('/analytics/'),
    tint: '#9B7EDE',
    icon: (
      <svg viewBox="0 0 20 20" className="h-6 w-6" {...STROKE} aria-hidden="true">
        <path d="M3 16.5h14" />
        <path d="M5.5 13.5v-4M10 13.5V6.5M14.5 13.5V9" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    match: (p) => p === '/profile' || p === '/channels' || p.startsWith('/profile/') || p.startsWith('/channels/'),
    tint: '#E87EA1',
    icon: (
      <svg viewBox="0 0 20 20" className="h-6 w-6" {...STROKE} aria-hidden="true">
        <circle cx="10" cy="7" r="3.2" />
        <path d="M3.8 16.5c.8-3 3.2-4.5 6.2-4.5s5.4 1.5 6.2 4.5" />
      </svg>
    ),
  },
];

const PLUS_OPTIONS = [
  {
    href: '/create?tab=post',
    label: 'Post',
    desc: 'Write and schedule',
    icon: (
      <svg viewBox="0 0 20 20" className="h-4 w-4" {...STROKE} aria-hidden="true">
        <path d="M13.5 3.5 16.5 6.5 7 16l-4 1 1-4L13.5 3.5Z" />
      </svg>
    ),
  },
  {
    href: '/create?tab=ideas',
    label: 'Ideas',
    desc: 'Capture it first',
    icon: (
      <svg viewBox="0 0 20 20" className="h-4 w-4" {...STROKE} aria-hidden="true">
        <path d="M10 2.5a5 5 0 0 0-3 9c.7.6 1 1.4 1 2.2h4c0-.8.3-1.6 1-2.2a5 5 0 0 0-3-9Z" />
        <path d="M8.5 16.5h3" />
      </svg>
    ),
  },
  {
    href: '/create?tab=templates',
    label: 'From template',
    desc: 'Start from a starter',
    icon: (
      <svg viewBox="0 0 20 20" className="h-4 w-4" {...STROKE} aria-hidden="true">
        <rect x="3" y="3" width="6" height="6" rx="1.5" />
        <rect x="11" y="3" width="6" height="6" rx="1.5" />
        <rect x="3" y="11" width="6" height="6" rx="1.5" />
        <rect x="11" y="11" width="6" height="6" rx="1.5" />
      </svg>
    ),
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
      </div>
    </nav>
  );
}
