import { redirect } from 'next/navigation';
import PostList from '@/components/PostList';
import { fetchPosts } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export default async function QueuePage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const posts = await fetchPosts(sb, ctx.workspace.id);
  return <PostList posts={posts} />;
}
