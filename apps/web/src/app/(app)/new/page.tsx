import { redirect } from 'next/navigation';
import CreateHub from '@/components/CreateHub';
import { fetchChannels } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Mobile-style Create hub: quick composer plus an ideas inbox. */
export default async function NewPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const channels = await fetchChannels(sb, ctx.workspace.id);
  return (
    <CreateHub
      channels={channels}
      workspaceId={ctx.workspace.id}
      userId={ctx.user.id}
      role={ctx.workspace.role}
    />
  );
}
