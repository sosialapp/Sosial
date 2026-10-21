import { redirect } from 'next/navigation';
import PostList from '@/components/PostList';
import { fetchLiveChannels, fetchPosts } from '@/lib/posts';
import { channelAvatar } from '@/lib/channelAvatar';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const metadata = { title: 'Queue' };


export default async function QueuePage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const [posts, channels] = await Promise.all([
    fetchPosts(sb, ctx.workspace.id),
    fetchLiveChannels(sb, ctx.workspace.id),
  ]);
  // Profile photos by channel id, same record the /post hub builds, so the
  // card head shows real avatars + handles instead of bare brand discs.
  const avatars: Record<string, string> = {};
  for (const c of channels) {
    const a = channelAvatar(c.metadata);
    if (a) avatars[c.id] = a;
  }
  return (
    <PostList
      posts={posts}
      role={ctx.workspace.role}
      userId={ctx.user.id}
      workspaceId={ctx.workspace.id}
      avatars={avatars}
      channels={channels}
    />
  );
}
