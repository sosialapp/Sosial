import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BRAND_PATHS, BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import ChannelDock from '@/components/site/ChannelDock';
import { GridPulse } from '@/components/ui/grid-pulse';
import { CHANNEL_GUIDES } from '@/content/channels';
import { channelHref } from '@/content/types';

export const metadata: Metadata = seo({
  path: '/integrations',
  title: 'Integrations for Instagram, TikTok, X and more',
  description: 'Connect Instagram, TikTok, X, Facebook, Threads, LinkedIn, YouTube, Pinterest, Bluesky, Mastodon, blogs and more. Schedule them all from one calendar.',
  kicker: 'Integrations',
  cardTitle: 'Every channel you use, in one calendar.',
});

const PROMISES = [
  ['Official APIs', 'Posts go out through each network’s real publishing API.'],
  ['Limits handled', 'Character counts, media sizes and formats checked per channel.'],
  ['One queue', 'Every channel shares the same calendar, retries and alerts.'],
] as const;

export default function IntegrationsIndex() {
  const logos = CHANNEL_GUIDES.map((c) => BRAND_PATHS[c.key as BrandProvider]).filter(Boolean);

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
            Integrations
          </p>
          <h1
            className="mt-4 max-w-3xl font-display text-[2.5rem] font-extrabold leading-[1.02] tracking-tight text-balance sm:text-5xl md:text-6xl"
            data-grid-avoid
          >
            Sosial × every channel you use.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg" data-grid-avoid>
            Real API publishing, per-channel limits handled for you, and honest notes on what each
            network actually rewards.
          </p>
          <div className="mt-8" data-grid-avoid>
            <ChannelDock label="Every channel" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PROMISES.map(([title, body]) => (
            <div key={title} className="border-t border-line pt-4">
              <p className="font-display text-sm font-extrabold tracking-tight">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
            {CHANNEL_GUIDES.length} networks, one calendar
          </h2>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNEL_GUIDES.map((c) => {
            return (
              <Link
                key={c.key}
                href={channelHref(c.key)}
                className="group flex h-full flex-col rounded-2xl border border-line bg-card p-5 transition hover:border-ink/30 md:p-6"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line">
                    <BrandIcon provider={c.key} className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-extrabold leading-tight tracking-tight">
                      {c.name}
                    </span>
                    <span className="block text-xs font-bold text-faint">
                      {c.limit.toLocaleString('en-US')} characters
                    </span>
                  </span>
                </span>
                <span className="mt-4 flex-1 text-sm leading-relaxed text-muted">{c.tagline}</span>
                <span className="mt-4 flex flex-wrap gap-1.5">
                  {c.bestFor.slice(0, 3).map((b) => (
                    <span key={b} className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-soft">
                      {b}
                    </span>
                  ))}
                </span>
                <span className="mt-5 flex items-center gap-1.5 border-t border-line pt-4 text-sm font-bold text-ink">
                  {c.name} guide
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
