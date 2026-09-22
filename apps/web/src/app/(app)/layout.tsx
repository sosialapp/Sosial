import Image from 'next/image';
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
        <ThemeToggle />
      </header>
      {/* Bottom clearance so the floating dock never covers content. */}
      <main className="min-w-0 flex-1 pb-32">{children}</main>
      <Dock />
    </ThemeScope>
  );
}
