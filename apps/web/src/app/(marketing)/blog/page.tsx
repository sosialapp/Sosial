import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { BlogJsonLd } from '@/components/site/JsonLd';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LayoutGrid } from 'lucide-react';
import { BLOG_TAGS, allArticles } from '@/lib/blog';
import { type Category } from '@/content/types';
import {
  ArticleCard, FeaturedArticle, HubHero, SideArticle, TAG_NOTES, TagIcon, tagTone,
} from '@/components/site/ResourceKit';

/** ISR so publishes go live without a rebuild. */
export const revalidate = 300;

export const metadata: Metadata = seo({
  path: '/blog',
  title: 'Social media marketing blog',
  description: 'Practical guides on social media strategy, scheduling, AI writing and running a content team across every channel, from the Sosial team.',
  kicker: 'Blog',
  cardTitle: 'Get better at publishing everywhere.',
});

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
  const all = await allArticles();
  const posts = active ? all.filter((a) => a.tag === active) : all;
  // Unfiltered: the newest leads big, the next three sit beside it, the rest grid below.
  const lead = active ? undefined : posts[0];
  const side = active ? [] : posts.slice(1, 4);
  const rest = active ? posts : posts.slice(4);

  const count = (t: Category) => all.filter((a) => a.tag === t).length;

  // Hero panel: the six topics as tinted tiles, each a shortcut to its filter.
  const topics = (
    <div className="grid grid-cols-2 gap-2.5">
      {BLOG_TAGS.map((t) => {
        const tone = tagTone(t);
        return (
          <Link
            key={t}
            href={`/blog?tag=${t}`}
            scroll={false}
            className="group relative overflow-hidden rounded-[20px] p-4 transition hover:-translate-y-0.5"
            style={{ backgroundColor: tone.bg, color: tone.ink }}
          >
            <TagIcon tag={t} className="absolute -right-2 -bottom-2 h-14 w-14 opacity-25 transition group-hover:-rotate-6 group-hover:opacity-40" />
            <p className="text-sm font-extrabold">{t}</p>
            <p className="mt-0.5 pr-6 text-xs leading-snug" style={{ color: tone.sub }}>
              {TAG_NOTES[t]}
            </p>
            <p className="mt-3 text-[11px] font-bold" style={{ color: tone.sub }}>
              {count(t)} {count(t) === 1 ? 'article' : 'articles'}
            </p>
          </Link>
        );
      })}
    </div>
  );

  // Topic tabs: icon and name, underlined when active. No counts, no colour.
  const tab = (href: string, label: string, on: boolean, icon: ReactNode) => (
    <Link
      key={href}
      href={href}
      scroll={false}
      aria-current={on ? 'page' : undefined}
      className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 py-4 text-sm font-medium transition ${
        on ? 'border-ink text-ink' : 'border-transparent text-ink/50 hover:text-ink'
      }`}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <>
      <BlogJsonLd posts={all} />
      <HubHero
        active="blog"
        title="Get better at publishing everywhere."
        lede="Strategy, scheduling systems, AI writing and team workflow, written for people who run social for a living."
        aside={topics}
      />

      {/* Topic filter: stays under the nav while you scroll the grid. */}
      <div className="sticky top-16 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <nav
          aria-label="Filter by topic"
          className="relative mx-auto flex max-w-[1200px] gap-7 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tab('/blog', 'All', !active, <LayoutGrid className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />)}
          {BLOG_TAGS.map((t) => tab(`/blog?tag=${t}`, t, active === t, <TagIcon tag={t} className="h-4 w-4" />))}
        </nav>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 py-12 md:py-16">
        {active ? (
          // A filtered page opens on the topic's own heading.
          <div className="mb-12 flex items-start gap-5 border-b border-line pb-10">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-paper text-ink">
              <TagIcon tag={active} className="h-[22px] w-[22px]" />
            </span>
            <div>
              <h2 className="font-display text-3xl font-[700] tracking-[-0.03em] md:text-4xl">{active}</h2>
              <p className="mt-2 max-w-md text-base text-ink/60">
                {TAG_NOTES[active]}. {posts.length} {posts.length === 1 ? 'article' : 'articles'}.
              </p>
            </div>
          </div>
        ) : null}

        {lead ? (
          <section aria-label="Latest" className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <FeaturedArticle a={lead} />
            {side.length ? (
              <div>
                <p className="text-sm font-medium text-ink/55">Also new</p>
                <div className="mt-4 divide-y divide-line">
                  {side.map((a, i) => (
                    <SideArticle key={a.slug} a={a} n={i + 2} />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {rest.length > 0 ? (
          <section aria-label="All articles" className={lead ? 'mt-14 border-t border-line pt-10' : ''}>
            {lead ? (
              <div className="mb-6 flex items-end justify-between gap-4">
                <h2 className="font-display text-2xl font-[700] tracking-[-0.03em] md:text-3xl">All articles</h2>
                <p className="text-sm text-ink/50">{all.length} in total</p>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <ArticleCard key={a.slug} a={a} />
              ))}
            </div>
          </section>
        ) : null}

        {posts.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-line px-6 py-14 text-center">
            <p className="font-display text-lg font-extrabold">Nothing here yet.</p>
            <p className="mt-1 text-sm text-muted">Try another topic, or read everything.</p>
            <Link href="/blog" className="btn btn-ghost mt-5">
              All articles
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
}
