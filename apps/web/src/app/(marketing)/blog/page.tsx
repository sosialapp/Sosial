import type { Metadata } from 'next';
import Link from 'next/link';
import { BLOG_TAGS, allArticles, articlesByTag } from '@/lib/blog';
import { blogTagClass, formatPostDate, type Category } from '@/content/types';

/** ISR so publishes go live without a rebuild. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Practical guides on social media strategy, scheduling, writing with AI and running a content team across ten channels.',
  alternates: { canonical: '/blog' },
};

function isTag(v: string | undefined): v is Category {
  return !!v && (BLOG_TAGS as readonly string[]).includes(v);
}

export default async function BlogIndex({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  const active = isTag(tag) ? tag : undefined;
  const posts = active ? await articlesByTag(active) : await allArticles();

  return (
    <>
      <section className="border-b border-line bg-card/60">
        <div className="mx-auto max-w-5xl px-4 py-14 md:py-20">
          <p className="eyebrow">Blog</p>
          <h1 className="mt-2 max-w-2xl font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            Get better at publishing everywhere.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
            Strategy, scheduling systems, AI writing and team workflow, written for people who run
            social for a living.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <nav aria-label="Filter by topic" className="flex flex-wrap items-center gap-2">
          <Link
            href="/blog"
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
              href={`/blog?tag=${t}`}
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

        <p className="mt-6 text-xs font-bold text-faint">
          {posts.length} {posts.length === 1 ? 'article' : 'articles'}
          {active ? ` on ${active}` : ''}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {posts.map((a) => (
            <Link
              key={a.slug}
              href={`/blog/${a.slug}`}
              className="card flex h-full flex-col overflow-hidden transition hover:border-accent"
            >
              {a.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.coverUrl}
                  alt={a.coverAlt || a.title}
                  loading="lazy"
                  className="aspect-[16/9] w-full object-cover"
                />
              ) : null}
              <div className="flex flex-1 flex-col p-5">
                <span className={`pill w-fit ${blogTagClass(a.tag)}`}>{a.tag}</span>
                <h2 className="mt-3 font-display text-lg font-extrabold leading-snug tracking-tight">
                  {a.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{a.description}</p>
                <p className="mt-4 text-xs font-bold text-faint">
                  {formatPostDate(a.date)} · {a.minutes} min read
                </p>
              </div>
            </Link>
          ))}
        </div>

        {posts.length === 0 && (
          <p className="mt-10 text-sm text-muted">Nothing here yet. Try another topic.</p>
        )}
      </div>
    </>
  );
}
