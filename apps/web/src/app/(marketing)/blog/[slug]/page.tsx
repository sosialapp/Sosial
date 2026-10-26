import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PostBody from '@/components/site/PostBody';
import SafeImg from '@/components/SafeImg';
import { ArticleJsonLd, BreadcrumbJsonLd } from '@/components/site/JsonLd';
import { allArticles, article, relatedArticles } from '@/lib/blog';
import { formatPostDate } from '@/content/types';
import { ArticleCard, BackLink, CtaBand, RailCard, ReadingLayout, TagChip } from '@/components/site/ResourceKit';
import { ShareLinks } from '@/components/site/ArticleAside';

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
      <ArticleJsonLd
        title={post.title}
        description={post.description}
        slug={post.slug}
        date={post.date}
        coverUrl={post.coverUrl}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
          { name: post.title, path: `/blog/${post.slug}` },
        ]}
      />
      <article>
        <header className="mx-auto max-w-[1200px] px-4 pt-10 sm:pt-14">
          <BackLink href="/blog" label="Blog" />
          <div className="mt-8 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <TagChip tag={post.tag} />
              <span className="text-xs font-bold text-faint">
                {formatPostDate(post.date)} · {post.minutes} min read
              </span>
            </div>
            <h1 className="mt-4 font-display text-[2.25rem] leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl md:text-[3.4rem]">
              {post.title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted md:text-xl">{post.description}</p>
            <p className="mt-6 flex items-center gap-2.5 text-sm text-muted">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-extrabold text-bone" aria-hidden="true">
                S
              </span>
              <span>
                By <b className="font-bold text-ink">the Sosial team</b>
              </span>
            </p>
          </div>
          {post.coverUrl ? (
            <div className="mt-10 overflow-hidden rounded-[28px] border border-line">
              <SafeImg src={post.coverUrl} alt={post.coverAlt ?? post.title} className="h-auto w-full" />
            </div>
          ) : null}
        </header>

        <ReadingLayout
          rail={
            <>
              <ShareLinks title={post.title} path={`/blog/${post.slug}`} />
              <RailCard title="Schedule this in Sosial" body="Write once, adapt for every channel and let the queue post on time." />
            </>
          }
        >
          <PostBody bodyHtml={post.bodyHtml} blocks={post.body} />
          {/* Below lg the rail is hidden, so share sits at the end of the article. */}
          <div className="mt-10 border-t border-line pt-6 lg:hidden">
            <ShareLinks title={post.title} path={`/blog/${post.slug}`} />
          </div>
        </ReadingLayout>

        <div className="mx-auto max-w-[1200px] px-4 pt-10 pb-16 md:pb-20">
          <CtaBand
            eyebrow="Put it to work"
            title="Schedule this week in one sitting."
            body="Draft with the AI writer, adapt to all ten channels and let the queue publish on time."
          />
        </div>
      </article>

      {related.length > 0 && (
        <section className="border-t border-line bg-card/60">
          <div className="mx-auto max-w-[1200px] px-4 py-14 md:py-20">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">Keep reading</h2>
              <BackLink href="/blog" label="All articles" />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((a) => (
                <ArticleCard key={a.slug} a={a} short />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
