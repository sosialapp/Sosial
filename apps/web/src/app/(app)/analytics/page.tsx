import { redirect } from 'next/navigation';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import { fetchChannels, fetchPostsLite } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const metadata = { title: 'Analytics' };


export const dynamic = 'force-dynamic';

/**
 * Analytics loader: posts + channels + engagement snapshots + follower
 * snapshots, all server-side. Snapshot queries degrade to empty on error
 * (cards show "-"), they must never take the page down.
 */
export default async function AnalyticsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  // ~6 months of follower history is plenty for the on-screen ranges; older
  // custom ranges simply carry the earliest available total forward.
  const historyFloor = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  // The comment report filters by the same client-side range, so load a year
  // once. Capped to keep the payload predictable on large workspaces.
  const commentFloor = new Date(Date.now() - 365 * 86400000).toISOString();
  const [posts, channels, postStats, channelStats, followerHistory, comments] = await Promise.all([
    fetchPostsLite(sb, ctx.workspace.id),
    fetchChannels(sb, ctx.workspace.id),
    sb
      .from('post_stats')
      .select('post_id, channel_id, provider, likes, comments, shares, views')
      .eq('workspace_id', ctx.workspace.id)
      .then((r) => (r.error ? [] : (r.data ?? []))),
    sb
      .from('channel_stats')
      .select('channel_id, provider, followers, fetched_at')
      .eq('workspace_id', ctx.workspace.id)
      .then((r) => (r.error ? [] : (r.data ?? []))),
    sb
      .from('channel_stats_history')
      .select('channel_id, provider, followers, captured_on')
      .eq('workspace_id', ctx.workspace.id)
      .gte('captured_on', historyFloor)
      .then((r) => (r.error ? [] : (r.data ?? []))),
    sb
      .from('comments')
      .select('id, channel_id, platform, author_name, body, created_at, status, is_own')
      .eq('workspace_id', ctx.workspace.id)
      .gte('created_at', commentFloor)
      .order('created_at', { ascending: false })
      .limit(5000)
      .then((r) => (r.error ? [] : (r.data ?? []))),
  ]);
  return (
    <AnalyticsDashboard
      posts={posts}
      channels={channels}
      postStats={postStats as never}
      channelStats={channelStats as never}
      followerHistory={followerHistory as never}
      commentRows={comments as never}
    />
  );
}
