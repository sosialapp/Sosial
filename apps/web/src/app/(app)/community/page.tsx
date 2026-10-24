import { redirect } from 'next/navigation';
import CommunityInbox from '@/components/CommunityInbox';
import { fetchLiveChannels } from '@/lib/posts';
import { getEntitlement } from '@/lib/billing/entitlement';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const metadata = { title: 'Community' };
export const dynamic = 'force-dynamic';

/**
 * Community (web parity with the mobile screen): Comments is the cached
 * platform-comments pipeline; Messages is the live stateless DM inbox
 * (paid plans only — the gate is re-enforced server-side in the edge
 * functions, the plan here only picks which UI renders).
 */
export default async function CommunityPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const [channels, ent] = await Promise.all([
    fetchLiveChannels(sb, ctx.workspace.id),
    getEntitlement(ctx.workspace.id),
  ]);
  return (
    <div className="w-full pt-3 sm:px-2 sm:pt-4">
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Community</h1>
      <p className="mt-0.5 hidden text-sm text-muted sm:block">Comments on your posts and your direct messages, in one place.</p>
      <div className="mt-3">
        <CommunityInbox channels={channels} workspaceId={ctx.workspace.id} plan={ent.plan} />
      </div>
    </div>
  );
}
