import { redirect } from 'next/navigation';
import CalendarBoard from '@/components/CalendarBoard';
import { fetchChannels, fetchMediaForPosts, fetchPostsLite } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

/** Year overview at its own URL. */
export default async function CalendarYearPage({
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
    <CalendarBoard posts={posts} channels={channels} media={media} initialView="year" initialAnchor={d} />
  );
}
