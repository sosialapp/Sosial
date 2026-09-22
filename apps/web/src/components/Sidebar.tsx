'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

interface NavItem {
  href: string;
  label: string;
  match: (p: string) => boolean;
  icon: React.ReactNode;
  /** Bolt-highlighted entry (the one create action). */
  primary?: boolean;
}

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Plan',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        match: (p) => p.startsWith('/dashboard'),
        icon: (
          <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" {...STROKE} aria-hidden="true">
            <rect x="3" y="3" width="6" height="6" rx="1.8" />
            <rect x="11" y="3" width="6" height="6" rx="1.8" />
            <rect x="3" y="11" width="6" height="6" rx="1.8" />
            <rect x="11" y="11" width="6" height="6" rx="1.8" />
          </svg>
        ),
      },
      {
        href: '/calendar',
        label: 'Calendar',
        match: (p) => p.startsWith('/calendar'),
        icon: (
          <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" {...STROKE} aria-hidden="true">
            <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
            <path d="M3 8.5h14M7 2.5v4M13 2.5v4" />
          </svg>
        ),
      },
      {
        href: '/queue',
        label: 'Queue',
        match: (p) => p.startsWith('/queue'),
        icon: (
          <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" {...STROKE} aria-hidden="true">
            <path d="M3.5 6h13M3.5 10h13M3.5 14h8" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Create',
    items: [
      {
        href: '/new',
        label: 'New post',
        match: (p) => p.startsWith('/new') || p.startsWith('/composer'),
        icon: (
          <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" {...STROKE} strokeWidth={2.1} aria-hidden="true">
            <path d="M10 4v12M4 10h12" />
          </svg>
        ),
        primary: true,
      },
    ],
  },
  {
    title: 'Review',
    items: [
      {
        href: '/analytics',
        label: 'Analytics',
        match: (p) => p.startsWith('/analytics'),
        icon: (
          <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" {...STROKE} aria-hidden="true">
            <path d="M3 16.5h14" />
            <path d="M5.5 13.5v-4M10 13.5V6.5M14.5 13.5V9" />
          </svg>
        ),
      },
      {
        href: '/channels',
        label: 'Channels',
        match: (p) => p.startsWith('/channels'),
        icon: (
          <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" {...STROKE} aria-hidden="true">
            <path d="M8.5 11.5a4.2 4.2 0 0 0 6 .4l2.4-2.4a4.24 4.24 0 0 0-6-6l-1.4 1.4" />
            <path d="M11.5 8.5a4.2 4.2 0 0 0-6-.4l-2.4 2.4a4.24 4.24 0 0 0 6 6l1.4-1.4" />
          </svg>
        ),
      },
      {
        href: '/team',
        label: 'Team',
        match: (p) => p.startsWith('/team'),
        icon: (
          <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" {...STROKE} aria-hidden="true">
            <circle cx="7" cy="7" r="2.6" />
            <path d="M2.5 16c.6-2.4 2.4-3.6 4.5-3.6s3.9 1.2 4.5 3.6" />
            <circle cx="13.5" cy="8" r="2.1" />
            <path d="M13.4 12.6c1.7.2 3 1.3 3.6 3" />
          </svg>
        ),
      },
      {
        href: '/profile',
        label: 'Profile',
        match: (p) => p.startsWith('/profile'),
        icon: (
          <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" {...STROKE} aria-hidden="true">
            <circle cx="10" cy="7" r="3.2" />
            <path d="M3.8 16.5c.8-3 3.2-4.5 6.2-4.5s5.4 1.5 6.2 4.5" />
          </svg>
        ),
      },
    ],
  },
];

/**
 * Postiz-style desktop sidebar: dark warm rail with grouped nav, the one
 * bolt create action, and the account block at the bottom. Mobile keeps
 * the floating dock instead (hidden below lg).
 */
export default function Sidebar({
  workspaceName,
  email,
}: {
  workspaceName: string;
  email: string;
}) {
  const pathname = usePathname();

  const linkCls = (item: NavItem): string => {
    if (item.primary) {
      return 'flex items-center gap-2.5 rounded-[10px] bg-bolt px-3 py-2 text-sm font-bold text-ink';
    }
    const active = item.match(pathname);
    return `flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-semibold transition ${
      active
        ? 'bg-white/10 text-paper'
        : 'text-paper/60 hover:bg-white/5 hover:text-paper'
    }`;
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/5 bg-ink px-3 py-4 lg:flex">
      <Link href="/dashboard" className="mb-4 flex items-center gap-2.5 px-2">
        <Image src="/bolt.png" alt="" width={26} height={26} />
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-extrabold text-paper">
            {workspaceName}
          </span>
          <span className="block text-[11px] text-paper/40">Sosial workspace</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto" aria-label="Main">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="px-3 pb-1.5 text-[11px] font-bold text-paper/35">{g.title}</p>
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <Link key={item.href} href={item.href} className={linkCls(item)}>
                  <span className={item.primary ? '' : 'shrink-0 opacity-80'} aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 border-t border-white/5 pt-3">
        <div className="flex items-center gap-2 px-2">
          <p className="min-w-0 flex-1 truncate text-xs text-paper/50">{email}</p>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
