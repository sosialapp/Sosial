import { redirect } from 'next/navigation';
import CalendarBoard from '@/components/CalendarBoard';
import { fetchChannels, fetchPosts } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export default async function CalendarPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const [posts, channels] = await Promise.all([
    fetchPosts(sb, ctx.workspace.id),
    fetchChannels(sb, ctx.workspace.id),
  ]);
  return <CalendarBoard posts={posts} channels={channels.length} />;
}
