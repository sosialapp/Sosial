import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PostBody from '@/components/site/PostBody';
import { allArticles, article, relatedArticles } from '@/lib/blog';
import { blogTagClass, formatPostDate } from '@/content/types';

/** ISR so publishes go live without a rebuild (new slugs render on demand). */
export const revalidate = 300;

export async function generateStaticParams() {
  return (await allArticles()).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await article(slug);
  if (!post) return { title: 'Article not found' };
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      ...(post.coverUrl ? { images: [{ url: post.coverUrl, alt: post.coverAlt ?? post.title }] } : {}),
    },
    twitter: {
      card: post.coverUrl ? 'summary_large_image' : 'summary',
      title: post.title,
      description: post.description,
      ...(post.coverUrl ? { images: [post.coverUrl] } : {}),
    },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await article(slug);
  if (!post) notFound();

  const related = await relatedArticles(slug);

  return (
    <>
      <article className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <Link href="/blog" className="text-xs font-bold text-muted hover:text-ink">
          ← All articles
        </Link>
        <div className="mt-6 flex items-center gap-2">
          <span className={`pill ${blogTagClass(post.tag)}`}>{post.tag}</span>
          <span className="text-xs font-bold text-faint">
            {formatPostDate(post.date)} · {post.minutes} min read
          </span>
        </div>
        <h1 className="mt-4 font-display text-3xl font-extrabold leading-[1.1] tracking-tight md:text-4xl">
          {post.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">{post.description}</p>

        {post.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverUrl}
            alt={post.coverAlt ?? post.title}
            className="mt-8 aspect-[16/9] w-full rounded-2xl border border-line object-cover"
          />
        ) : null}

        <hr className="my-8 border-line" />

        <PostBody bodyHtml={post.bodyHtml} blocks={post.body} />

        <div className="reveal mt-12 rounded-3xl border border-line bg-card p-6 md:p-8">
          <p className="eyebrow">Put it to work</p>
          <h2 className="mt-2 font-display text-xl font-extrabold tracking-tight">
            Schedule this week in one sitting.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Draft with the AI writer, adapt to all ten channels and let the queue publish on time.
          </p>
          <Link href="/login" className="btn btn-primary mt-5">
            Start scheduling free
          </Link>
        </div>
      </article>

      {related.length > 0 && (
        <section className="border-t border-line bg-card/60">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="font-display text-2xl font-extrabold tracking-tight">Keep reading</h2>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {related.map((a) => (
                <Link
                  key={a.slug}
                  href={`/blog/${a.slug}`}
                  className="card flex h-full flex-col overflow-hidden transition hover:border-accent"
                >
                  {a.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.coverUrl}
                      alt={a.coverAlt ?? a.title}
                      loading="lazy"
                      className="aspect-[16/9] w-full object-cover"
                    />
                  ) : null}
                  <div className="flex flex-1 flex-col p-5">
                    <span className={`pill w-fit ${blogTagClass(a.tag)}`}>{a.tag}</span>
                    <h3 className="mt-3 font-display text-base font-extrabold leading-snug tracking-tight">
                      {a.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{a.description}</p>
                    <p className="mt-4 text-xs font-bold text-faint">{a.minutes} min read</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
