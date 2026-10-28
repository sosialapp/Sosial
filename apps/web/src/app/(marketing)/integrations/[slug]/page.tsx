import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { docsUrl } from '@/lib/site';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import { BRAND_PATHS, BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import ChannelDock from '@/components/site/ChannelDock';
import PageCms from '@/components/site/PageCms';
import { GridPulse } from '@/components/ui/grid-pulse';
import { CHANNEL_GUIDES, channelGuide, relatedChannels } from '@/content/channels';
import { channelHref } from '@/content/types';
import { BreadcrumbJsonLd } from '@/components/site/JsonLd';
import { formatPageDate, sitePageMeta } from '@/lib/sitePages';

export function generateStaticParams() {
  return CHANNEL_GUIDES.map((c) => ({ slug: c.key }));
}

/** CMS edits go live within minutes. */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = channelGuide(slug);
  if (!c) return { title: 'Integration not found' };
  const meta = await sitePageMeta(`integrations/${slug}`);
  // "Instagram scheduler" and "schedule Instagram posts" are what people search.
  const long = `${c.tagline} Schedule ${c.name} posts from one calendar, with live limits, previews and a cloud queue.`;
  const short = `${c.tagline} Schedule ${c.name} posts from one calendar with Sosial.`;
  return seo({
    path: channelHref(c.key),
    title: meta?.metaTitle ?? `${c.name} scheduler: schedule ${c.name} posts`,
    description: meta?.metaDescription ?? (long.length <= 160 ? long : short),
    kicker: `${c.name} integration`,
    cardTitle: `Schedule ${c.name} posts with Sosial`,
    channel: c.key,
  });
}

/**
 * One network's page: hero with the at-a-glance facts beside it, then the
 * playbook (tips on a numbered rail, mistakes, FAQ) with a sticky aside for
 * fit, the connect call and sibling channels.
 */
export default async function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = channelGuide(slug);
  if (!c) notFound();

  const meta = await sitePageMeta(`integrations/${slug}`);
  const date = formatPageDate(meta?.publishedAt ?? null);
  const related = relatedChannels(slug);
  const mark = BRAND_PATHS[c.key as BrandProvider];

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', path: '/' },
          { name: 'Integrations', path: '/integrations' },
          { name: c.name, path: channelHref(c.key) },
        ]}
      />
      <section className="relative overflow-clip border-b border-line bg-card/60">
        <GridPulse
          cell={26}
          ambient={3}
          reach={3}
          maxLit={220}
          logos={mark ? [mark] : undefined}
          logoChance={0.5}
          blockSizes={[1, 2, 3]}
          blockWeights={[0.6, 0.28, 0.12]}
        />
        <div className="relative z-[2] mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 md:py-16 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <Link
              href="/integrations"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-ink"
              data-grid-avoid
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              All integrations
            </Link>
            <div className="mt-6 flex items-center gap-4" data-grid-avoid>
              <span
                className="grid h-16 w-16 shrink-0 place-items-center rounded-[20px] border border-line bg-card"
              >
                <BrandIcon provider={c.key} className="h-9 w-9" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-faint">Integration</p>
                <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-balance md:text-5xl">
                  {meta?.title ?? `Schedule ${c.name} posts with Sosial`}
                </h1>
              </div>
            </div>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg" data-grid-avoid>
              {meta?.metaDescription ?? c.tagline}
            </p>
            {date ? (
              <p className="mt-3 text-xs font-bold text-faint" data-grid-avoid>
                Updated {date}
              </p>
            ) : null}
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row" data-grid-avoid>
              <Link href="/login" className="btn btn-primary btn-lg justify-center">
                Connect {c.name}
              </Link>
              <Link href="#tips" className="btn btn-ghost btn-lg justify-center">
                How to win on {c.name}
              </Link>
            </div>
            <a
              href={`${docsUrl()}/${c.key}`}
              className="group mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-ink/70 hover:text-ink"
              data-grid-avoid
            >
              Step-by-step {c.name} setup in the docs
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          </div>

          {/* At a glance: the facts that decide whether this channel fits. */}
          <div
            className="rounded-[24px] border border-line bg-card p-5 shadow-[0_24px_60px_-32px_rgba(28,26,20,0.4)] md:p-6"
            data-grid-avoid
          >
            <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
              <p className="font-display text-base font-extrabold tracking-tight">At a glance</p>
              <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold tabular-nums text-soft">
                {c.limit.toLocaleString('en-US')} chars
              </span>
            </div>
            <dl className="divide-y divide-line">
              {c.facts.map((f) => (
                <div key={f.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-3">
                  <dt className="text-xs font-bold text-faint">{f.label}</dt>
                  <dd className="text-sm font-semibold leading-relaxed text-soft">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="relative z-[2] mx-auto max-w-6xl px-4 pb-10">
          <ChannelDock active={c.key} />
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <p className="text-lg leading-relaxed text-soft">{c.intro}</p>

          <PageCms slug={`integrations/${slug}`} className="mt-8" />

          <section id="tips" className="mt-12 scroll-mt-24">
            <h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
              How to win on {c.name}
            </h2>
            <ol className="relative mt-6 space-y-3 before:absolute before:top-4 before:bottom-4 before:left-[19px] before:w-px before:bg-line">
              {c.tips.map((t, i) => (
                <li key={t.title} className="relative flex gap-4">
                  <span className="relative z-[1] grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent font-display text-sm font-extrabold text-on-accent ring-4 ring-bone">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl border border-line bg-card p-4 md:p-5">
                    <h3 className="font-display text-lg font-extrabold tracking-tight">{t.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12">
            <h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">Common mistakes</h2>
            <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {c.pitfalls.map((p) => (
                <li key={p} className="flex gap-3 rounded-2xl bg-surface p-4 text-sm leading-relaxed text-soft">
                  <span
                    className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#FDEBEC] text-[#9F2F2D]"
                    aria-hidden="true"
                  >
                    <X className="h-3 w-3" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12">
            <h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
              {c.name} on Sosial: FAQ
            </h2>
            <div className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {c.faqs.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display text-[15px] font-bold transition hover:bg-surface [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span
                      aria-hidden="true"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface text-ink transition group-open:rotate-45"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[24px] border border-line bg-card p-5">
            <p className="font-display text-sm font-extrabold tracking-tight">Best for</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.bestFor.map((b) => (
                <span key={b} className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-soft">
                  {b}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] bg-ink p-5 text-bone">
            <BrandIcon provider={c.key} mono className="h-7 w-7 text-bone" />
            <p className="mt-3 font-display text-lg font-extrabold leading-tight tracking-tight">
              Schedule your first {c.name} post today.
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-bone/70">Free to start. Connect in under a minute.</p>
            <Link href="/login" className="btn btn-bolt mt-4 w-full justify-center">
              Connect {c.name}
            </Link>
          </div>
          {related.length > 0 ? (
            <div className="rounded-[24px] border border-line bg-card p-5">
              <p className="font-display text-sm font-extrabold tracking-tight">Also publishes to</p>
              <div className="mt-3 space-y-1">
                {related.map((r) => (
                  <Link
                    key={r.key}
                    href={channelHref(r.key)}
                    className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface"
                  >
                    <BrandIcon provider={r.key} className="h-6 w-6 shrink-0" />
                    <span className="flex-1 text-sm font-bold">{r.name}</span>
                    <ArrowRight
                      className="h-4 w-4 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
