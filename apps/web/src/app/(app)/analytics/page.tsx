import { redirect } from 'next/navigation';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import { fetchChannels, fetchPostsLite } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Analytics loader: posts + channels + engagement snapshots + follower
 * snapshots, all server-side. All interactivity (ranges, channel filter,
 * sorting, exports) lives in AnalyticsDashboard — the loader stays thin so
 * data shapes stay in one place.
 */
export default async function AnalyticsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const [posts, channels, postStats, channelStats] = await Promise.all([
    fetchPostsLite(sb, ctx.workspace.id),
    fetchChannels(sb, ctx.workspace.id),
    sb.from('post_stats').select('post_id, channel_id, provider, likes, comments, shares, views'),
    sb.from('channel_stats').select('channel_id, provider, followers, fetched_at'),
  ]);
  if (postStats.error) throw new Error(postStats.error.message);
  if (channelStats.error) throw new Error(channelStats.error.message);
  return (
    <AnalyticsDashboard
      posts={posts}
      channels={channels}
      postStats={(postStats.data ?? []) as never}
      channelStats={(channelStats.data ?? []) as never}
    />
  );
}
