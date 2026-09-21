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
    match: (p) => p === '/calendar' || p === '/queue' || p.startsWith('/calendar/') || p.startsWith('/queue/'),
    icon: () => (
      <svg viewBox="0 0 20 20" className="h-5 w-5" {...STROKE} aria-hidden="true">
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
    match: (p) => p === '/composer' || p.startsWith('/composer/'),
    icon: () => (
      <svg viewBox="0 0 20 20" className="h-5 w-5" {...STROKE} aria-hidden="true">
        <path d="M13.5 3.5 16.5 6.5 7 16l-4 1 1-4L13.5 3.5Z" />
      </svg>
    ),
  },
  {
    href: '/composer',
    label: 'New post',
    match: () => false,
    hero: true,
    icon: () => (
      <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
        <path d="M10 3.5v13M3.5 10h13" />
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    match: (p) => p === '/analytics' || p.startsWith('/analytics/'),
    icon: () => (
      <svg viewBox="0 0 20 20" className="h-5 w-5" {...STROKE} aria-hidden="true">
        <path d="M3 16.5h14" />
        <path d="M5.5 13.5v-4M10 13.5V6.5M14.5 13.5V9" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    match: (p) => p === '/profile' || p === '/channels' || p.startsWith('/profile/') || p.startsWith('/channels/'),
    icon: () => (
      <svg viewBox="0 0 20 20" className="h-5 w-5" {...STROKE} aria-hidden="true">
        <circle cx="10" cy="7" r="3.2" />
        <path d="M3.8 16.5c.8-3 3.2-4.5 6.2-4.5s5.4 1.5 6.2 4.5" />
      </svg>
    ),
  },
];

/**
 * macOS-style dock — magnification ported from the GSAP reference pen
 * (icons swell + spread apart near the cursor with a cosine falloff).
 *
 * Progressive enhancement: a static, fully usable dock in the markup; the
 * magnification only attaches on fine pointers without reduced-motion.
 */
export default function Dock() {
  const pathname = usePathname();
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const select = () =>
      Array.from(dock.querySelectorAll<HTMLElement>('[data-dock-icon]'));
    let icons = select();
    if (!icons.length) return;

    gsap.set(icons, { transformOrigin: '50% 100%' });
    gsap.from(dock, { y: 28, autoAlpha: 0, duration: 0.6, ease: 'power3.out' });

    const pitch = () => {
      icons = select();
      if (icons.length < 2) return 60;
      const gap = icons[1].offsetLeft - icons[0].offsetLeft;
      return Math.max(44, gap || 60);
    };

    const onMove = (e: MouseEvent) => {
      const min = pitch();
      const max = min * 2.1;
      const bound = min * Math.PI;
      for (const icon of icons) {
        const r = icon.getBoundingClientRect();
        const distance = r.left + r.width / 2 - e.clientX;
        let scale = 1;
        let x = 0;
        if (Math.abs(distance) < bound) {
          const rad = (distance / min) * 0.5;
          scale = 1 + (max / min - 1) * Math.cos(rad);
          x = 2 * (max - min) * Math.sin(rad);
        } else {
          x = (distance < 0 ? 2 : -2) * (max - min);
        }
        gsap.to(icon, { duration: 0.3, scale, x, ease: 'power2.out', overwrite: 'auto' });
      }
    };

    const onLeave = () => {
      gsap.to(icons, { duration: 0.35, scale: 1, x: 0, ease: 'power3.out', overwrite: 'auto' });
    };

    dock.addEventListener('mousemove', onMove);
    dock.addEventListener('mouseleave', onLeave);
    return () => {
      dock.removeEventListener('mousemove', onMove);
      dock.removeEventListener('mouseleave', onLeave);
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
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className="group relative flex w-14 flex-col items-center"
            >
              <span className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-lg border border-line bg-ink px-2.5 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {item.label}
              </span>
              <span
                data-dock-icon
                className={
                  item.hero
                    ? 'flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-[0_10px_24px_-10px_rgba(200,80,15,0.8)] transition-colors hover:bg-accent-bright'
                    : `flex h-12 w-12 items-center justify-center rounded-2xl border transition-colors ${
                        active
                          ? 'border-accent bg-accent text-white'
                          : 'border-line bg-paper text-soft hover:bg-bone dark:hover:bg-white/5'
                      }`
                }
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
