import Link from 'next/link';
import type { ReactNode } from 'react';
import { Box, Compass, Send, Sparkles, TrendingUp, Users } from 'lucide-react';
import SafeImg from '@/components/SafeImg';
import { ArticleToc } from '@/components/site/ArticleAside';
import { formatPostDate, type Article, type Category, type Resource, type ResourceKind } from '@/content/types';

/**
 * Shared pieces for the Resources section (Blog + Library). Server components.
 * Same language as the pricing cards: soft pastel panels with dark ink, big
 * rounded corners, hairline borders. Cards in a grid share one shape, so rows
 * line up whether or not a post has a cover.
 */

import { KIND_TONES, TAG_TONES, type Tone } from '@/content/tones';

export { KIND_TONES, TAG_TONES };

/** One line on what each library kind is for. */
export const KIND_NOTES: Record<ResourceKind, string> = {
  Playbook: 'Step-by-step plans for a specific day or campaign.',
  Glossary: 'Plain-language definitions you can send to a client.',
  Guide: 'How to set something up properly, start to finish.',
  Template: 'Fill-in documents to copy into your own workspace.',
  'Cheat sheet': 'One-page references to keep open while you work.',
};

/** One line per blog topic, for the hero's topic tiles. */
export const TAG_NOTES: Record<Category, string> = {
  Publishing: 'Formats, timing, the queue',
  Strategy: 'Plans that survive a busy week',
  AI: 'Writing with help, not autopilot',
  Teams: 'Roles, approvals, hand-offs',
  Growth: 'Reach that compounds',
  Product: 'What is new in Sosial',
};

export function tagTone(tag: Category): Tone {
  return TAG_TONES[tag] ?? TAG_TONES.Publishing;
}

export function kindTone(kind: ResourceKind): Tone {
  return KIND_TONES[kind] ?? KIND_TONES.Guide;
}

/** Section headings of a library item, for "What's inside" lists. */
export function resourceSections(r: Resource): string[] {
  return r.body.filter((b): b is { t: 'h'; c: string } => b.t === 'h').map((b) => b.c);
}

const TAG_ICONS: Record<Category, typeof Send> = {
  Publishing: Send,
  Strategy: Compass,
  AI: Sparkles,
  Teams: Users,
  Growth: TrendingUp,
  Product: Box,
};

export function TagIcon({ tag, className }: { tag: Category; className?: string }) {
  const Icon = TAG_ICONS[tag] ?? Send;
  return <Icon aria-hidden="true" strokeWidth={1.4} className={className} />;
}

/** Topic chip in the tag's own tint. */
export function TagChip({ tag }: { tag: Category }) {
  const t = tagTone(tag);
  return (
    <span className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: t.bg, color: t.ink }}>
      {tag}
    </span>
  );
}

/**
 * Section hero for both indexes: the Blog / Library switch, a big title and
 * lede on the left, and a right-hand panel (topic tiles, kind tiles) in the
 * space that used to sit empty. The panel hides below lg.
 */
export function HubHero({
  active,
  title,
  lede,
  aside,
  children,
}: {
  active: 'blog' | 'library';
  title: string;
  lede: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  const tab = (key: 'blog' | 'library', href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? 'page' : undefined}
      className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
        active === key ? 'bg-ink text-bone' : 'text-muted hover:text-ink'
      }`}
    >
      {label}
    </Link>
  );
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 pt-10 pb-10 sm:pt-14 md:pb-12 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <nav aria-label="Resources" className="inline-flex rounded-full border border-line bg-card p-1">
            {tab('blog', '/blog', 'Blog')}
            {tab('library', '/resources', 'Library')}
          </nav>
          <h1 className="mt-6 max-w-2xl font-display text-[2.4rem] leading-[1.04] font-extrabold tracking-tight text-balance sm:text-5xl md:text-[3.4rem]">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{lede}</p>
          {children ? <div className="mt-7">{children}</div> : null}
        </div>
        {aside ? <div className="hidden lg:block">{aside}</div> : null}
      </div>
    </section>
  );
}

/**
 * A post's cover at a fixed ratio. Without an image: the topic's own tint
 * with its icon, never the title again (the title sits right under it).
 */
function Cover({
  a,
  ratio = 'aspect-[16/10]',
  big = false,
  label = true,
}: {
  a: Article;
  ratio?: string;
  big?: boolean;
  /** Topic word in the corner; off for thumbnails that print it beside them. */
  label?: boolean;
}) {
  const t = tagTone(a.tag);
  return (
    <div className={`relative w-full overflow-hidden ${ratio}`} style={{ backgroundColor: t.bg }}>
      {a.coverUrl ? (
        <SafeImg
          src={a.coverUrl}
          alt={a.coverAlt ?? a.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0" style={{ color: t.ink }}>
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.18]"
            style={{ backgroundImage: `radial-gradient(${t.sub} 1px, transparent 1px)`, backgroundSize: '14px 14px' }}
          />
          {label ? (
            <span className="absolute top-4 left-4 text-[10px] font-extrabold tracking-[0.14em] uppercase" style={{ color: t.sub }}>
              {a.tag}
            </span>
          ) : null}
          <TagIcon
            tag={a.tag}
            className={`absolute transition duration-500 group-hover:-rotate-6 ${
              big ? 'right-5 bottom-5 h-24 w-24' : label ? 'right-5 bottom-5 h-12 w-12' : 'inset-0 m-auto h-9 w-9'
            }`}
          />
        </div>
      )}
    </div>
  );
}

function ArticleMeta({ a, short = false }: { a: Article; short?: boolean }) {
  return (
    <p className="text-xs font-bold text-faint">
      {short ? `${a.minutes} min read` : `${formatPostDate(a.date)} · ${a.minutes} min read`}
    </p>
  );
}

const titleHover = 'group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4';

/** Grid card, editorial: a framed cover, then tag + length, title, summary, date. */
export function ArticleCard({ a, short = false }: { a: Article; short?: boolean }) {
  return (
    <Link href={`/blog/${a.slug}`} className="group flex h-full flex-col">
      <div className="overflow-hidden rounded-[22px] border border-line">
        <Cover a={a} />
      </div>
      <div className="flex flex-1 flex-col px-1 pt-4">
        <div className="flex items-center gap-2">
          <TagChip tag={a.tag} />
          <ArticleMeta a={a} short />
        </div>
        <h3 className={`mt-2.5 font-display text-lg leading-snug font-extrabold tracking-tight text-balance ${titleHover}`}>{a.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{a.description}</p>
        {short ? null : <p className="mt-3 text-xs font-bold text-faint">{formatPostDate(a.date)}</p>}
      </div>
    </Link>
  );
}

/** The newest post, big: framed cover on top, a large title under it. */
export function FeaturedArticle({ a }: { a: Article }) {
  return (
    <Link href={`/blog/${a.slug}`} className="group flex h-full flex-col">
      <div className="overflow-hidden rounded-[28px] border border-line">
        <Cover a={a} ratio="aspect-[16/9]" big />
      </div>
      <div className="px-1 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-bone">Latest</span>
          <TagChip tag={a.tag} />
          <ArticleMeta a={a} />
        </div>
        <h2 className={`mt-3 font-display text-[1.75rem] leading-[1.08] font-extrabold tracking-tight text-balance md:text-[2.25rem] ${titleHover}`}>
          {a.title}
        </h2>
        <p className="mt-3 line-clamp-2 max-w-2xl text-base leading-relaxed text-muted">{a.description}</p>
      </div>
    </Link>
  );
}

/** Compact numbered row for the "also new" column beside the lead story. */
export function SideArticle({ a, n }: { a: Article; n: number }) {
  return (
    <Link href={`/blog/${a.slug}`} className="group grid grid-cols-[112px_minmax(0,1fr)] items-start gap-4 py-4 first:pt-0 last:pb-0">
      <div className="overflow-hidden rounded-[16px] border border-line">
        <Cover a={a} ratio="aspect-[4/3]" label={false} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold tracking-[0.14em] text-faint uppercase">
          {String(n).padStart(2, '0')} · {a.tag}
        </p>
        <h3 className={`mt-1.5 line-clamp-3 font-display text-base leading-snug font-extrabold tracking-tight ${titleHover}`}>{a.title}</h3>
        <p className="mt-1.5 text-xs font-bold text-faint">{a.minutes} min read</p>
      </div>
    </Link>
  );
}

/** Library card, wide: the kind's pastel panel on the left, what's inside on the right. */
export function ResourceCard({ r, href }: { r: Resource; href: string }) {
  const t = kindTone(r.kind);
  const sections = resourceSections(r);
  return (
    <Link
      href={href}
      className="group grid overflow-hidden rounded-[28px] border border-line bg-card transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(28,25,23,0.35)] md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
    >
      <div className="flex flex-col justify-between gap-10 p-6 md:p-8" style={{ backgroundColor: t.bg, color: t.ink }}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-extrabold tracking-[0.14em] uppercase" style={{ color: t.sub }}>
            {r.kind}
          </span>
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold">{r.minutes} min</span>
        </div>
        <div>
          <h3 className="font-display text-2xl leading-[1.1] font-extrabold tracking-tight text-balance md:text-[1.9rem]">{r.title}</h3>
          <p className="mt-2.5 max-w-md text-sm leading-relaxed" style={{ color: t.sub }}>
            {r.description}
          </p>
        </div>
      </div>
      <div className="flex flex-col p-6 md:p-8">
        {sections.length ? (
          <>
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-faint uppercase">What&apos;s inside</p>
            <ol className="mt-3 divide-y divide-line-soft">
              {sections.slice(0, 5).map((s, i) => (
                <li key={s} className="flex items-baseline gap-3 py-2 text-sm text-ink">
                  <span className="w-5 shrink-0 text-xs font-bold text-faint tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0">{s}</span>
                </li>
              ))}
            </ol>
            {sections.length > 5 ? (
              <p className="mt-1 pl-8 text-xs font-bold text-faint">+{sections.length - 5} more sections</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm leading-relaxed text-muted">{KIND_NOTES[r.kind]}</p>
        )}
        <span className="mt-auto pt-6 text-sm font-bold text-ink transition group-hover:translate-x-0.5">
          Open {r.kind.toLowerCase()} →
        </span>
      </div>
    </Link>
  );
}

/** Small library card for "more from the library" rows. */
export function ResourceTile({ r, href }: { r: Resource; href: string }) {
  const t = kindTone(r.kind);
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-[28px] bg-surface pb-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(28,25,23,0.35)]"
    >
      <div className="relative min-h-[132px] rounded-[28px_28px_20px_20px] px-5 pt-5 pb-5" style={{ backgroundColor: t.bg, color: t.ink }}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-extrabold tracking-[0.14em] uppercase" style={{ color: t.sub }}>
            {r.kind}
          </span>
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold">{r.minutes} min</span>
        </div>
        <h3 className="mt-4 font-display text-xl leading-snug font-extrabold tracking-tight text-balance">{r.title}</h3>
      </div>
      <div className="flex flex-1 flex-col px-5 pt-4">
        <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-muted">{r.description}</p>
        <span className="mt-5 text-sm font-bold text-ink transition group-hover:translate-x-0.5">Open {r.kind.toLowerCase()} →</span>
      </div>
    </Link>
  );
}

/** Dark closing band with the sign-up button, shared by both detail pages. */
export function CtaBand({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="reveal rounded-[28px] bg-ink p-7 text-bone md:flex md:items-center md:justify-between md:gap-8 md:p-10">
      <div className="max-w-xl">
        <p className="text-[11px] font-extrabold tracking-[0.14em] text-bone/60 uppercase">{eyebrow}</p>
        <h2 className="mt-2 font-display text-2xl leading-tight font-extrabold tracking-tight md:text-[1.75rem]">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-bone/70">{body}</p>
      </div>
      <Link href="/login" className="btn btn-bolt btn-lg mt-6 shrink-0 justify-center md:mt-0">
        Start scheduling free
      </Link>
    </div>
  );
}

/** Small "← Blog" style link at the top of a detail page. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-bold text-muted transition hover:text-ink">
      <span aria-hidden="true">←</span>
      {label}
    </Link>
  );
}

/**
 * Reading layout for both detail pages: contents on the left, the article in
 * the middle, share + a small sign-up card on the right. Side columns are
 * sticky and only appear at lg; below that the article is one column.
 */
export function ReadingLayout({ children, rail }: { children: ReactNode; rail: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1200px] gap-10 px-4 pt-10 pb-4 md:pt-14 lg:grid-cols-[190px_minmax(0,700px)_190px] lg:justify-between">
      <div className="hidden lg:block">
        <div className="sticky top-[88px]">
          <ArticleToc />
        </div>
      </div>
      <div data-article-body className="min-w-0">
        {children}
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-[88px]">{rail}</div>
      </div>
    </div>
  );
}

/** Right-rail card: a nudge to try the product, sized for the sticky column. */
export function RailCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 rounded-[20px] bg-surface p-4">
      <p className="font-display text-sm leading-snug font-extrabold tracking-tight">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{body}</p>
      <Link href="/login" className="btn btn-bolt mt-3 w-full justify-center !py-2 !text-xs">
        Try Sosial free
      </Link>
    </div>
  );
}
