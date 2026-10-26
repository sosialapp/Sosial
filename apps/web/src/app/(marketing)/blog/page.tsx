import type { Metadata } from 'next';
import Link from 'next/link';
import { BLOG_TAGS, allArticles } from '@/lib/blog';
import { type Category } from '@/content/types';
import {
  ArticleCard, FeaturedArticle, HubHero, SideArticle, TAG_NOTES, TagIcon, tagTone,
} from '@/components/site/ResourceKit';

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
  const all = await allArticles();
  const count = (t: Category) => all.filter((a) => a.tag === t).length;
  const posts = active ? all.filter((a) => a.tag === active) : all;
  // Unfiltered: the newest leads big, the next three sit beside it, the rest grid below.
  const lead = active ? undefined : posts[0];
  const side = active ? [] : posts.slice(1, 4);
  const rest = active ? posts : posts.slice(4);

  const pill = (href: string, label: string, on: boolean, n: number, dot?: string) => (
    <Link
      key={href}
      href={href}
      scroll={false}
      aria-current={on ? 'page' : undefined}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-bold transition ${
        on ? 'border-ink bg-ink text-bone' : 'border-line bg-card text-muted hover:text-ink'
      }`}
    >
      {dot ? <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} /> : null}
      {label}
      <span className={`text-[11px] tabular-nums ${on ? 'text-bone/60' : 'text-faint'}`}>{n}</span>
    </Link>
  );

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

  return (
    <>
      <HubHero
        active="blog"
        title="Get better at publishing everywhere."
        lede="Strategy, scheduling systems, AI writing and team workflow, written for people who run social for a living."
        aside={topics}
      />

      {/* Topic filter: stays under the nav while you scroll the grid. */}
      <div className="sticky top-16 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-3">
          <nav aria-label="Filter by topic" className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {pill('/blog', 'All', !active, all.length)}
            {BLOG_TAGS.map((t) => pill(`/blog?tag=${t}`, t, active === t, count(t), tagTone(t).sub))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 py-10 md:py-14">
        {active ? (
          // A filtered page opens on the topic's own panel.
          <div
            className="relative mb-10 overflow-hidden rounded-[28px] px-6 py-7 md:px-9 md:py-9"
            style={{ backgroundColor: tagTone(active).bg, color: tagTone(active).ink }}
          >
            <TagIcon tag={active} className="absolute -right-4 -bottom-6 h-40 w-40 opacity-20" />
            <p className="text-[11px] font-extrabold tracking-[0.14em] uppercase" style={{ color: tagTone(active).sub }}>
              Topic · {posts.length} {posts.length === 1 ? 'article' : 'articles'}
            </p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">{active}</h2>
            <p className="mt-2 max-w-md text-sm" style={{ color: tagTone(active).sub }}>
              {TAG_NOTES[active]}.
            </p>
          </div>
        ) : null}

        {lead ? (
          <section aria-label="Latest" className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <FeaturedArticle a={lead} />
            {side.length ? (
              <div>
                <p className="text-[11px] font-extrabold tracking-[0.14em] text-faint uppercase">Also new</p>
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
                <h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">All articles</h2>
                <p className="text-xs font-bold text-faint">{all.length} in total</p>
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
