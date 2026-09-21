import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchChannels, fetchPosts } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** First pass: real workspace totals. Per-post charts land next. */
export default async function AnalyticsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const [posts, channels] = await Promise.all([
    fetchPosts(sb, ctx.workspace.id),
    fetchChannels(sb, ctx.workspace.id),
  ]);

  const sent = posts.filter((p) => p.status === 'sent' || p.status === 'partial').length;
  const scheduled = posts.filter(
    (p) => p.status === 'queued' || p.status === 'publishing' || p.status === 'approval',
  ).length;
  const drafts = posts.filter((p) => p.status === 'draft' || p.status === 'failed').length;
  const liveChannels = channels.filter((c) => c.status === 'connected').length;

  const stats = [
    { label: 'Posts sent', value: sent },
    { label: 'Scheduled', value: scheduled },
    { label: 'Drafts & needs attention', value: drafts },
    { label: 'Channels live', value: `${liveChannels}/${channels.length}` },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6">
      <p className="eyebrow">Analytics</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">How you&apos;re doing</h1>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="font-display text-2xl font-extrabold">{s.value}</p>
            <p className="mt-1 text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card mt-4 p-6 text-center">
        <p className="font-display text-base font-extrabold">Per-post charts are on the way</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Likes, comments and reach per channel will show up here once the stats pipeline lands. Your totals above are already live.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link href="/composer" className="btn btn-primary">
            Create a post
          </Link>
          <Link href="/calendar" className="btn btn-ghost">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
