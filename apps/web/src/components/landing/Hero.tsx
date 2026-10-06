'use client';

import { useState } from 'react';
import Image from 'next/image';
import AuthModal from '@/components/site/AuthModal';
import { GridPulse } from '@/components/ui/grid-pulse';
import { BRAND_PATHS, type BrandProvider } from '@/components/BrandIcon';

/**
 * Fold (Tenner architecture, Sosial brand): eyebrow, headline with a rotated
 * highlight word, dual CTAs, proof checklist, and the devices render —
 * floating over an interactive GridPulse field whose lit cells occasionally
 * carry channel marks. No stock.
 */

const HERO_LOGOS: BrandProvider[] = [
  'x',
  'instagram',
  'tiktok',
  'facebook',
  'threads',
  'youtube',
  'linkedin',
  'bluesky',
  'mastodon',
  'pinterest',
  'telegram',
  'discord',
  'reddit',
  'vk',
];

const btn =
  'inline-flex items-center justify-center gap-2.5 rounded-full border-2 border-ink font-display text-base font-semibold px-6 py-3.5 leading-none transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_0_-2px_rgba(28,26,20,0.18)]';

export default function Hero() {
  const [auth, setAuth] = useState<null | 'in' | 'up'>(null);

  return (
    <section className="relative overflow-clip [touch-action:pan-y]">
      <GridPulse
        cell={26}
        logos={HERO_LOGOS.map((p) => BRAND_PATHS[p])}
        logoChance={0.22}
        ambient={3}
      />

      <div className="relative z-[2] mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-6 px-4 py-8 sm:gap-10 sm:py-10 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[0.85fr_1.15fr]">
        <div className="text-center lg:text-left">
          <h1
            data-grid-avoid
            className="animate-rise-1 font-display text-[2rem] leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl"
          >
            Sosial. Made for{' '}
            <span className="underline decoration-bolt decoration-[0.14em] underline-offset-[0.18em]">
              everyone who posts
            </span>
            .
          </h1>
          <p
            data-grid-avoid
            className="animate-rise-1 mx-auto mt-4 max-w-xl text-[15px] leading-relaxed sm:text-base md:text-lg lg:mx-0"
          >
            Creators, founders, marketers, agencies, affiliate marketers and
            everyone in between.
          </p>
          <div className="animate-rise-2 mt-6 flex flex-wrap items-center justify-center gap-3 sm:mt-7 lg:justify-start">
            <button type="button" onClick={() => setAuth('up')} className={`${btn} w-full max-w-xs bg-ink text-paper sm:w-auto sm:max-w-none`}>
              Start scheduling free
              <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
        <div className="animate-rise-2 relative -mx-4 sm:mx-0">
          <Image
            src="/hero-devices.png"
            alt="Sosial composer on a laptop beside the Sosial home screen on a phone"
            width={1540}
            height={959}
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="h-auto w-full lg:scale-[1.12] lg:origin-center"
          />
        </div>
      </div>
      <AuthModal open={auth !== null} mode={auth ?? 'up'} onClose={() => setAuth(null)} />
    </section>
  );
}
