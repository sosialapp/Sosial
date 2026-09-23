import { redirect } from 'next/navigation';
import Composer from '@/components/Composer';
import { fetchLiveChannels } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export default async function ComposerPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const channels = await fetchLiveChannels(sb, ctx.workspace.id);
  return (
    <Composer
      channels={channels}
      workspaceId={ctx.workspace.id}
      userId={ctx.user.id}
      role={ctx.workspace.role}
    />
  );
}
