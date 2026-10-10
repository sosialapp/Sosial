import { redirect } from 'next/navigation';
import ScheduleXBoard from '@/components/ScheduleXBoard';
import { fetchChannels, fetchMediaForPosts, fetchPostsLite } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

/** Month grid at its own URL. */
export default async function CalendarMonthPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const { d } = await searchParams;
  const [posts, channels] = await Promise.all([
    fetchPostsLite(sb, ctx.workspace.id),
    fetchChannels(sb, ctx.workspace.id),
  ]);
  const media = await fetchMediaForPosts(
    sb,
    ctx.workspace.id,
    posts.map((p) => p.id),
  );
  return (
    <ScheduleXBoard posts={posts} channels={channels} media={media} initialView="month" initialAnchor={d} />
  );
}

