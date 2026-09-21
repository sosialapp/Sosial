import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import { getWorkspaceContext, hasSupabaseEnv } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!hasSupabaseEnv()) redirect('/login');
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  return (
    <div className="app-shell flex min-h-screen bg-bone text-ink">
      <Sidebar workspaceName={ctx.workspace.name} email={ctx.user.email ?? ''} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
