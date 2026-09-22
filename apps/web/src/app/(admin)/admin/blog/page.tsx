import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Owner post list: drafts and published, newest-touched first. */
export default async function AdminBlogList() {
  const sb = await createClient();
  const { data } = await sb
    .from('blog_posts')
    .select('id, slug, title, tag, minutes, status, published_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);
  const rows = data ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Owner console</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Blog</h1>
          <p className="mt-1 text-sm text-muted">{rows.length} posts</p>
        </div>
        <Link
          href="/admin/blog/new"
          className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-bone"
        >
          + New post
        </Link>
      </div>
      <div className="mt-4 grid gap-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card px-4 py-3"
          >
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                r.status === 'published'
                  ? 'border-accent bg-accent-soft text-accent-ink'
                  : 'border-line bg-paper text-muted'
              }`}
            >
              {r.status}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{r.title}</p>
              <p className="truncate text-xs text-muted">
                /blog/{r.slug} · {r.tag} · {r.minutes} min
              </p>
            </div>
            {r.status === 'published' ? (
              <Link
                href={`/blog/${r.slug}`}
                className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft"
              >
                View
              </Link>
            ) : null}
            <Link
              href={`/admin/blog/${r.id}`}
              className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft"
            >
              Edit
            </Link>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">
            No posts yet. Write the first one.
          </p>
        ) : null}
      </div>
    </div>
  );
}
