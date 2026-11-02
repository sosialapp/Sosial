import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BRAND_PATHS, BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import ChannelDock from '@/components/site/ChannelDock';
import { GridPulse } from '@/components/ui/grid-pulse';
import { CHANNEL_GUIDES } from '@/content/channels';
import { integrationsCopy } from '@/content/pages/integrations';
import { channelHref } from '@/content/types';
import { fill } from '@/lib/i18n/locales';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const c = integrationsCopy[locale];
  return seo({
    path: '/integrations',
    locale,
    title: c.metaTitle,
    description: c.metaDesc,
    kicker: c.eyebrow,
    cardTitle: c.cardTitle,
  });
}

export default async function IntegrationsIndex() {
  const locale = await getLocale();
  const c = integrationsCopy[locale];
  const logos = CHANNEL_GUIDES.map((g) => BRAND_PATHS[g.key as BrandProvider]).filter(Boolean);

  return (
    <>
      <section className="relative overflow-clip border-b border-line bg-card/60">
        <GridPulse
          cell={26}
          ambient={3}
          reach={3}
          maxLit={220}
          logos={logos}
          logoChance={0.28}
          blockSizes={[1, 2, 3]}
          blockWeights={[0.6, 0.28, 0.12]}
        />
        <div className="relative z-[2] mx-auto max-w-6xl px-4 py-14 sm:py-20 md:py-24">
          <p className="text-sm font-bold text-muted" data-grid-avoid>
            {c.eyebrow}
          </p>
          <h1
            className="mt-4 max-w-3xl font-display text-[2.5rem] font-extrabold leading-[1.02] tracking-tight text-balance sm:text-5xl md:text-6xl"
            data-grid-avoid
          >
            {c.title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg" data-grid-avoid>
            {c.lede}
          </p>
          <div className="mt-8" data-grid-avoid>
            <ChannelDock label={c.dockLabel} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {c.promises.map((p) => (
            <div key={p.title} className="border-t border-line pt-4">
              <p className="font-display text-sm font-extrabold tracking-tight">{p.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
            {fill(c.networks, { n: CHANNEL_GUIDES.length })}
          </h2>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNEL_GUIDES.map((g) => {
            // The channel guides themselves stay English; the cards follow the locale.
            const card = c.channels[g.key] ?? { tagline: g.tagline, bestFor: g.bestFor };
            return (
              <Link
                key={g.key}
                href={channelHref(g.key)}
                className="group flex h-full flex-col rounded-2xl border border-line bg-card p-5 transition hover:border-ink/30 md:p-6"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line">
                    <BrandIcon provider={g.key} className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-extrabold leading-tight tracking-tight">
                      {g.name}
                    </span>
                    <span className="block text-xs font-bold text-faint">
                      {fill(c.characters, { n: g.limit.toLocaleString(locale === 'en' ? 'en-US' : locale) })}
                    </span>
                  </span>
                </span>
                <span className="mt-4 flex-1 text-sm leading-relaxed text-muted">{card.tagline}</span>
                <span className="mt-4 flex flex-wrap gap-1.5">
                  {card.bestFor.slice(0, 3).map((b) => (
                    <span key={b} className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-soft">
                      {b}
                    </span>
                  ))}
                </span>
                <span className="mt-5 flex items-center gap-1.5 border-t border-line pt-4 text-sm font-bold text-ink">
                  {fill(c.guide, { name: g.name })}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
