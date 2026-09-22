import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import Dock from '@/components/Dock';
import ThemeScope from '@/components/ThemeScope';
import ThemeToggle from '@/components/ThemeToggle';
import { getWorkspaceContext, hasSupabaseEnv } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!hasSupabaseEnv()) redirect('/login');
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  return (
    <ThemeScope className="app-shell min-h-screen bg-bone text-ink">
      {/* Slim top bar — the sidebar is gone; primary nav lives in the dock. */}
      <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line bg-card/90 px-4 py-3 backdrop-blur">
        <Image src="/bolt.png" alt="Sosial" width={24} height={24} />
        <p className="min-w-0 flex-1 truncate font-display text-sm font-extrabold">{ctx.workspace.name}</p>
        <p className="hidden truncate text-xs text-muted sm:block">{ctx.user.email}</p>
        <Link
          href="/channels"
          className="hidden items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:bg-bone sm:flex"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8.5 11.5a4.2 4.2 0 0 0 6 .4l2.4-2.4a4.24 4.24 0 0 0-6-6l-1.4 1.4" />
            <path d="M11.5 8.5a4.2 4.2 0 0 0-6-.4l-2.4 2.4a4.24 4.24 0 0 0 6 6l1.4-1.4" />
          </svg>
          Connect
        </Link>
        <Link
          href="/team"
          className="hidden items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:bg-bone sm:flex"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
            <circle cx="7" cy="7" r="2.6" />
            <path d="M2.5 16c.6-2.4 2.4-3.6 4.5-3.6s3.9 1.2 4.5 3.6" />
            <circle cx="13.5" cy="8" r="2.1" />
            <path d="M13.4 12.6c1.7.2 3 1.3 3.6 3" />
          </svg>
          Team
        </Link>
        <ThemeToggle />
      </header>
      {/* Bottom clearance so the floating dock never covers content. */}
      <main className="mx-auto min-w-0 w-full max-w-7xl flex-1 pb-32">{children}</main>
      <Dock />
    </ThemeScope>
  );
}
