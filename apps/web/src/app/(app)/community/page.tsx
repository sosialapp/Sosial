import { redirect } from 'next/navigation';
import CommunityInbox from '@/components/CommunityInbox';
import { fetchLiveChannels } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const metadata = { title: 'Community' };
export const dynamic = 'force-dynamic';

/**
 * Community (web parity with the mobile screen): platform comments on the
 * workspace's published posts, with inline replies on Facebook + Threads.
 */
export default async function CommunityPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const channels = await fetchLiveChannels(sb, ctx.workspace.id);
  return (
    <div className="w-full px-4 pt-6 sm:px-6">
      <p className="eyebrow">Community</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Comments</h1>
      <p className="mt-1 text-sm text-muted">What people say about your published posts, and your replies.</p>
      <div className="mt-4">
        <CommunityInbox channels={channels} />
      </div>
    </div>
  );
}
