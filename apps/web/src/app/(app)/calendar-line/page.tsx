import { redirect } from 'next/navigation';
import CalendarBoard from '@/components/CalendarBoard';
import { fetchChannels, fetchPosts } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

/** Agenda list at its own URL. */
export default async function CalendarLinePage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const [posts, channels] = await Promise.all([
    fetchPosts(sb, ctx.workspace.id),
    fetchChannels(sb, ctx.workspace.id),
  ]);
  return <CalendarBoard posts={posts} channels={channels} initialView="line" />;
}
