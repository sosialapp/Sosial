import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import ThemeScope from '@/components/ThemeScope';
import ThemeToggle from '@/components/ThemeToggle';
import { createClient, hasSupabaseEnv } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Owner console shell. Gated by the global is_app_admin() check (P11):
 *  signed-out → /login; signed-in non-admin → 404 (no existence leak).
 *  Deliberately separate from the (app) shell — no workspace dock here. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!hasSupabaseEnv()) redirect('/login');
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/login');
  const { data: admin } = await sb.rpc('is_app_admin');
  if (admin !== true) notFound();

  return (
    <ThemeScope className="app-shell min-h-screen bg-bone text-ink">
      <header className="sticky top-0 z-40 flex h-[60px] items-center gap-2.5 overflow-hidden border-b border-line bg-card px-4">
        <p className="min-w-0 flex-1 truncate font-display text-sm font-extrabold">Owner console</p>
        <p className="hidden shrink-0 truncate text-xs text-muted sm:block">{user.email}</p>
        <nav className="flex shrink-0 items-center gap-1.5 overflow-x-auto no-scrollbar">
          <Link
            href="/admin"
            className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:bg-bone"
          >
            Overview
          </Link>
          <Link
            href="/admin/reports"
            className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:bg-bone"
          >
            Reports
          </Link>
          <Link
            href="/admin/blog"
            className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:bg-bone"
          >
            Blog
          </Link>
          <Link
            href="/admin/notifications"
            className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:bg-bone"
          >
            Push
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:bg-bone"
          >
            ← App
          </Link>
        </nav>
        <ThemeToggle />
      </header>
      <main className="mx-auto min-w-0 w-full max-w-7xl flex-1 px-4 pb-32 pt-6 sm:px-6">{children}</main>
    </ThemeScope>
  );
}
