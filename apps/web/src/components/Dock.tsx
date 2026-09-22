'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

type DockItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  icon: (active: boolean) => React.ReactNode;
  /** Flat glyph color per item (no tile — just the colored mark). */
  color: string;
  hero?: boolean;
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
    href: '/calendar',
    label: 'Dashboard',
    color: 'text-[#1d7fe0]',
    match: (p) => p === '/calendar' || p === '/queue' || p.startsWith('/calendar/') || p.startsWith('/queue/'),
    icon: () => (
      <svg viewBox="0 0 20 20" className="h-7 w-7" {...STROKE} aria-hidden="true">
        <rect x="3" y="3" width="6" height="6" rx="1.8" />
        <rect x="11" y="3" width="6" height="6" rx="1.8" />
        <rect x="3" y="11" width="6" height="6" rx="1.8" />
        <rect x="11" y="11" width="6" height="6" rx="1.8" />
      </svg>
    ),
  },
  {
    href: '/composer',
    label: 'Create',
    color: 'text-[#ef6a10]',
    match: (p) => p === '/composer' || p.startsWith('/composer/'),
    icon: () => (
      <svg viewBox="0 0 20 20" className="h-7 w-7" {...STROKE} aria-hidden="true">
        <path d="M13.5 3.5 16.5 6.5 7 16l-4 1 1-4L13.5 3.5Z" />
      </svg>
    ),
  },
  {
    href: '/composer',
    label: 'New post',
    color: 'text-accent',
    match: () => false,
    hero: true,
    icon: () => (
      <svg viewBox="0 0 20 20" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
        <path d="M10 3.5v13M3.5 10h13" />
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    color: 'text-[#12914a]',
    match: (p) => p === '/analytics' || p.startsWith('/analytics/'),
    icon: () => (
      <svg viewBox="0 0 20 20" className="h-7 w-7" {...STROKE} aria-hidden="true">
        <path d="M3 16.5h14" />
        <path d="M5.5 13.5v-4M10 13.5V6.5M14.5 13.5V9" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    color: 'text-[#7c5cf0]',
    match: (p) => p === '/profile' || p === '/channels' || p.startsWith('/profile/') || p.startsWith('/channels/'),
    icon: () => (
      <svg viewBox="0 0 20 20" className="h-7 w-7" {...STROKE} aria-hidden="true">
        <circle cx="10" cy="7" r="3.2" />
        <path d="M3.8 16.5c.8-3 3.2-4.5 6.2-4.5s5.4 1.5 6.2 4.5" />
      </svg>
    ),
  },
];

/**
 * macOS-style dock with a hover float: the hovered icon lifts and swells
 * while its neighbours peek up. Deliberately discrete (per-item
 * mouseenter) instead of the continuous cursor-tracked magnification from
 * the GSAP reference pen — tracking getBoundingClientRect() every
 * mousemove feeds transformed rects back into the math and jitters.
 *
 * Progressive enhancement: a static, fully usable dock in the markup; the
 * float only attaches when JS runs without reduced-motion.
 */
export default function Dock() {
  const pathname = usePathname();
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.from(dock, { y: 28, autoAlpha: 0, duration: 0.6, ease: 'power3.out' });

    const items = Array.from(dock.querySelectorAll<HTMLElement>('[data-dock-item]'));
    const icons = items.map((el) => el.querySelector<HTMLElement>('[data-dock-icon]')).filter((el): el is HTMLElement => !!el);
    if (!items.length || !icons.length) return;
    gsap.set(icons, { transformOrigin: '50% 100%' });

    const reset = () =>
      gsap.to(icons, { duration: 0.45, y: 0, scale: 1, ease: 'power3.out', overwrite: 'auto' });

    const removers: (() => void)[] = [];
    items.forEach((item, i) => {
      const enter = () => {
        icons.forEach((icon, j) => {
          const d = Math.abs(i - j);
          gsap.to(icon, {
            duration: 0.35,
            y: d === 0 ? -12 : d === 1 ? -6 : 0,
            scale: d === 0 ? 1.18 : d === 1 ? 1.08 : 1,
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

  return (
    <nav aria-label="Primary" className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div
        ref={dockRef}
        className="pointer-events-auto flex items-end gap-1.5 rounded-3xl border border-line bg-card/85 px-3 pb-2.5 pt-2.5 shadow-[0_18px_50px_-16px_rgba(25,21,18,0.45)] backdrop-blur-xl"
      >
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              data-dock-item
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className="group relative flex w-14 flex-col items-center"
            >
              {/* Tooltip floats well clear of the risen icon (which climbs ~22px)
                  and pins above it so the float can never cover the text. */}
              <span className="pointer-events-none absolute -top-12 z-20 whitespace-nowrap rounded-lg border border-line bg-ink px-2.5 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {item.label}
              </span>
              <span
                data-dock-icon
                className={`flex items-center justify-center transition-opacity duration-150 ${
                  item.hero ? 'h-14 w-14' : 'h-12 w-12'
                } ${item.color} ${active ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`}
              >
                {item.icon(active)}
              </span>
              <span
                aria-hidden="true"
                className={`mt-1 h-1 w-1 rounded-full transition-opacity ${active && !item.hero ? 'bg-accent opacity-100' : 'opacity-0'}`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
