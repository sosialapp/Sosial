import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import CreateHub from '@/components/CreateHub';
import { fetchLiveChannels } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Mobile-style Post hub: quick composer, templates, publish, ideas. */
export default async function PostPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const channels = await fetchLiveChannels(sb, ctx.workspace.id);
  return (
    <Suspense
      fallback={
        <div className="w-full px-4 pt-6 sm:px-6">
          <p className="eyebrow">Post</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">New post</h1>
        </div>
      }
    >
      <CreateHub
        channels={channels}
        workspaceId={ctx.workspace.id}
        userId={ctx.user.id}
        role={ctx.workspace.role}
      />
    </Suspense>
  );
}
