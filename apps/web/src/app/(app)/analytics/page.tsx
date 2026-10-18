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
  const [posts, channels, postStats, channelStats, followerHistory] = await Promise.all([
    fetchPostsLite(sb, ctx.workspace.id),
    fetchChannels(sb, ctx.workspace.id),
    sb
      .from('post_stats')
      .select('post_id, channel_id, provider, likes, comments, shares, views')
      .then((r) => (r.error ? [] : (r.data ?? []))),
    sb
      .from('channel_stats')
      .select('channel_id, provider, followers, fetched_at')
      .then((r) => (r.error ? [] : (r.data ?? []))),
    sb
      .from('channel_stats_history')
      .select('channel_id, provider, followers, captured_on')
      .gte('captured_on', historyFloor)
      .then((r) => (r.error ? [] : (r.data ?? []))),
  ]);
  return (
    <AnalyticsDashboard
      posts={posts}
      channels={channels}
      postStats={postStats as never}
      channelStats={channelStats as never}
      followerHistory={followerHistory as never}
    />
  );
}
