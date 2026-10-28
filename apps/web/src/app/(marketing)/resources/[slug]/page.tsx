import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { notFound } from 'next/navigation';
import PostBody from '@/components/site/PostBody';
import { formatPageDate, sitePageHtml, sitePageMeta } from '@/lib/sitePages';
import { allResources, resource } from '@/content/resources';
import { resourceHref } from '@/content/types';
import { BreadcrumbJsonLd } from '@/components/site/JsonLd';
import { BackLink, CtaBand, RailCard, ReadingLayout, ResourceTile, kindTone, resourceSections } from '@/components/site/ResourceKit';
import { ShareLinks } from '@/components/site/ArticleAside';

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
  const meta = await sitePageMeta(`resources/${slug}`);
  return seo({
    path: resourceHref(item.slug),
    title: meta?.metaTitle ?? meta?.title ?? item.title,
    description: meta?.metaDescription ?? item.description,
    kicker: item.kind,
    cardTitle: meta?.title ?? item.title,
  });
}

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = resource(slug);
  if (!item) notFound();

  const more = allResources()
    .filter((r) => r.slug !== item.slug)
    .slice(0, 3);
  const meta = await sitePageMeta(`resources/${slug}`);
  const date = formatPageDate(meta?.publishedAt ?? null);
  const cmsHtml = await sitePageHtml(`resources/${slug}`);
  const tone = kindTone(item.kind);
  const sections = resourceSections(item);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', path: '/' },
          { name: 'Resources', path: '/resources' },
          { name: item.title, path: resourceHref(item.slug) },
        ]}
      />
      <article>
        <div className="mx-auto max-w-[1200px] px-4 pt-10 sm:pt-14">
          <BackLink href="/resources" label="Library" />
          {/* The kind's pastel panel, like a pricing card header grown full width. */}
          <header
            className="mt-6 grid gap-8 rounded-[28px] px-6 pt-7 pb-8 md:px-12 md:pt-10 md:pb-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end"
            style={{ backgroundColor: tone.bg, color: tone.ink }}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold tracking-[0.14em] uppercase" style={{ color: tone.sub }}>
                  {item.kind}
                </span>
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold">{item.minutes} min read</span>
                {date ? (
                  <span className="text-xs font-bold" style={{ color: tone.sub }}>
                    Published {date}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-4 max-w-3xl font-display text-[2.25rem] leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl md:text-[3.25rem]">
                {meta?.title ?? item.title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed" style={{ color: tone.sub }}>
                {meta?.metaDescription ?? item.description}
              </p>
            </div>
            {sections.length ? (
              <div className="rounded-[20px] bg-white/70 p-5">
                <p className="text-[11px] font-extrabold tracking-[0.14em] uppercase" style={{ color: tone.sub }}>
                  {sections.length} sections
                </p>
                <ol className="mt-2 grid gap-1.5 text-sm">
                  {sections.slice(0, 5).map((h, i) => (
                    <li key={h} className="flex gap-2.5">
                      <span className="w-4 shrink-0 text-xs font-bold tabular-nums" style={{ color: tone.sub }}>
                        {i + 1}
                      </span>
                      <span className="min-w-0">{h}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </header>
        </div>

        <ReadingLayout
          rail={
            <>
              <ShareLinks title={meta?.title ?? item.title} path={resourceHref(item.slug)} />
              <RailCard title="Turn this into posts" body="Sosial schedules it across every channel you run. Free to start." />
            </>
          }
        >
          <PostBody bodyHtml={cmsHtml} blocks={item.body} />
          <div className="mt-10 border-t border-line pt-6 lg:hidden">
            <ShareLinks title={meta?.title ?? item.title} path={resourceHref(item.slug)} />
          </div>
        </ReadingLayout>

        <div className="mx-auto max-w-[1200px] px-4 pt-10 pb-16 md:pb-20">
          <CtaBand
            eyebrow="Next step"
            title="Put this into a live calendar."
            body="Sosial turns these into scheduled posts across all ten channels. Free to start."
          />
        </div>
      </article>

      {more.length > 0 ? (
        <section className="border-t border-line bg-card/60">
          <div className="mx-auto max-w-[1200px] px-4 py-14 md:py-20">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">More from the library</h2>
              <BackLink href="/resources" label="Everything" />
            </div>
            <div className="mt-6 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((r) => (
                <ResourceTile key={r.slug} r={r} href={resourceHref(r.slug)} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
