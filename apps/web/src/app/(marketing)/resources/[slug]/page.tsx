import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PostBody from '@/components/site/PostBody';
import { sitePageHtml } from '@/lib/sitePages';
import { allResources, resource } from '@/content/resources';
import { resourceHref } from '@/content/types';

/** CMS edits go live within minutes. */
export const revalidate = 300;

export function generateStaticParams() {
  return allResources().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = resource(slug);
  if (!item) return { title: 'Resource not found' };
  return {
    title: item.title,
    description: item.description,
    alternates: { canonical: resourceHref(item.slug) },
    openGraph: { title: item.title, description: item.description },
  };
}

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = resource(slug);
  if (!item) notFound();

  const more = allResources()
    .filter((r) => r.slug !== item.slug)
    .slice(0, 3);
  const cmsHtml = await sitePageHtml(`resources/${slug}`);

  return (
    <>
      <article className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <Link href="/resources" className="text-xs font-bold text-muted hover:text-ink">
          ← Resource library
        </Link>
        <div className="mt-6 flex items-center gap-2">
          <span className="pill bg-paper text-soft ring-1 ring-line">{item.kind}</span>
          <span className="text-xs font-bold text-faint">{item.minutes} min read</span>
        </div>
        <h1 className="mt-4 font-display text-3xl font-extrabold leading-[1.1] tracking-tight md:text-4xl">
          {item.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">{item.description}</p>

        <hr className="my-8 border-line" />

        <PostBody bodyHtml={cmsHtml} blocks={item.body} />

        <div className="reveal mt-12 rounded-3xl border border-line bg-card p-6 md:p-8">
          <p className="eyebrow">Next step</p>
          <h2 className="mt-2 font-display text-xl font-extrabold tracking-tight">
            Put this into a live calendar.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Sosial turns these into scheduled posts across all ten channels. Free to start.
          </p>
          <Link href="/login" className="btn btn-primary mt-5">
            Start scheduling free
          </Link>
        </div>
      </article>

      <section className="border-t border-line bg-card/60">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">More resources</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {more.map((r) => (
              <Link
                key={r.slug}
                href={resourceHref(r.slug)}
                className="card flex h-full flex-col p-5 transition hover:border-accent"
              >
                <span className="pill w-fit bg-paper text-soft ring-1 ring-line">{r.kind}</span>
                <h3 className="mt-3 font-display text-base font-extrabold leading-snug tracking-tight">
                  {r.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{r.description}</p>
                <p className="mt-4 text-xs font-bold text-faint">{r.minutes} min</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
