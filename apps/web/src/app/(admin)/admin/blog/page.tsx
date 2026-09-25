import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { BLOG_TAGS, blogTagClass, type Category } from '@/content/types';

export const dynamic = 'force-dynamic';

function isTag(v: string | undefined): v is Category {
  return !!v && (BLOG_TAGS as readonly string[]).includes(v);
}

/** Owner post list: drafts and published, newest-touched first, filterable by category. */
export default async function AdminBlogList({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  const active = isTag(tag) ? tag : undefined;
  const sb = await createClient();
  let query = sb
    .from('blog_posts')
    .select('id, slug, title, tag, minutes, status, published_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (active) query = query.eq('tag', active);
  const { data } = await query;
  const rows = data ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Owner console</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Blog</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} posts{active ? ` in ${active}` : ''}
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-bone"
        >
          + New post
        </Link>
      </div>
      <nav aria-label="Filter by category" className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/blog"
          className={`pill border px-3 py-1.5 text-xs ${
            active
              ? 'border-line bg-paper text-muted hover:border-faint'
              : 'border-accent bg-accent-soft text-accent-ink'
          }`}
        >
          All
        </Link>
        {BLOG_TAGS.map((t) => (
          <Link
            key={t}
            href={`/admin/blog?tag=${t}`}
            className={`pill border px-3 py-1.5 text-xs ${
              active === t
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-paper text-muted hover:border-faint'
            }`}
          >
            {t}
          </Link>
        ))}
      </nav>
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
              <p className="mt-1 flex flex-wrap items-center gap-1.5 truncate text-xs text-muted">
                <span className={`pill w-fit ${blogTagClass((r.tag as Category) ?? 'Publishing')}`}>
                  {r.tag}
                </span>
                <span>
                  /blog/{r.slug} · {r.minutes} min
                </span>
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
