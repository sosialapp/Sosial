import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import CreateHub, { type Tab } from '@/components/CreateHub';
import { fetchLiveChannels, fetchPosts } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const VALID_TABS: Tab[] = ['post', 'templates', 'publish', 'ideas'];

/**
 * Mobile-style Post hub: quick composer, templates, publish, ideas.
 * One shared server component behind four URLs — /post, /post-templates,
 * /post-publish, /post-ideas. The legacy ?tab= param still works and only
 * selects the initial tab; the path stays canonical.
 */
export default async function HubPage({ tab, searchTab }: { tab: Tab; searchTab?: string }) {
  const initialTab: Tab = (VALID_TABS as string[]).includes(searchTab ?? '')
    ? (searchTab as Tab)
    : tab;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const [channels, posts] = await Promise.all([
    fetchLiveChannels(sb, ctx.workspace.id),
    fetchPosts(sb, ctx.workspace.id),
  ]);
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
        initialPosts={posts}
        initialTab={initialTab}
      />
    </Suspense>
  );
}
