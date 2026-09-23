import Link from 'next/link';
import { allArticles } from '@/lib/blog';
import { formatPostDate } from '@/content/types';
import { ImageSlot } from '@/components/ui';

/** First image block in the article body, if the author added one. */
function coverOf(body: unknown[]): string | null {
  for (const b of body) {
    if (typeof b === 'object' && b !== null) {
      const t = (b as { t?: unknown }).t;
      const c = (b as { c?: unknown }).c;
      if (t === 'img' && typeof c === 'string' && c.length > 0) return c;
    }
  }
  return null;
}

/**
 * News section: the 4 latest blog posts as cards with graphics. Uses the
 * article's own first image when it has one, otherwise a finished empty
 * image slot waiting for real art.
 */
export default async function BlogNews() {
  const posts = (await allArticles()).slice(0, 4);
  if (posts.length === 0) return null;
  return (
    <section aria-label="Latest from the blog" className="border-t border-line">
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="eyebrow">News</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
              Latest from the blog.
            </h2>
          </div>
          <Link href="/blog" className="btn btn-ghost">
            Read the blog
          </Link>
        </div>
        <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {posts.map((a) => {
            const cover = coverOf(a.body);
            return (
              <Link
                key={a.slug}
                href={`/blog/${a.slug}`}
                className="card flex h-full flex-col overflow-hidden transition hover:border-ink"
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full border-b border-line object-cover"
                  />
                ) : (
                  <ImageSlot
                    size="md"
                    className="aspect-square w-full !rounded-none !border-x-0 !border-t-0"
                    label={`${a.title} cover image placeholder`}
                  />
                )}
                <div className="flex flex-1 flex-col p-5">
                  <span className="pill w-fit bg-paper-dim text-ink">{a.tag}</span>
                  <h3 className="mt-3 font-display text-base font-extrabold leading-snug tracking-tight">
                    {a.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">
                    {a.description}
                  </p>
                  <p className="mt-4 text-xs font-bold text-faint">
                    {formatPostDate(a.date)} · {a.minutes} min read
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
