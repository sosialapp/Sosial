'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandIcon } from '@/components/BrandIcon';
import AuthModal from '@/components/site/AuthModal';
import type { ProviderKey } from '@/lib/types';

/**
 * Bespoke split-studio hero (Tenner method): the product drawn as toy-like
 * CSS objects — a phone running a scheduled post, flanked by a tilted queue
 * card and a tilted posted card. No raster assets, no stock, no JS motion
 * (CSS float only, silenced under prefers-reduced-motion).
 *
 * Palette trace: paper ground + ink text/bezels (brand tokens); bolt yellow
 * (brand accent) for the sun, CTA and sent states; cream blob (accent-soft
 * token); powder blue (illustration-only calm-sky contrast for the media
 * block); channel discs are the real product marks.
 */

const DOCK: ProviderKey[] = ['threads', 'instagram', 'tiktok', 'x'];

function Phone() {
  return (
    <div className="relative z-10 mx-auto w-56 rounded-[2.6rem] bg-ink p-2 shadow-[0_44px_90px_-32px_rgba(28,26,20,0.5)]">      <div className="overflow-hidden rounded-[2rem] bg-paper px-4 pt-3 pb-4">
        <div className="mx-auto h-1.5 w-16 rounded-full bg-ink/10" />
        <div className="mt-3 flex items-center gap-2">
          <span className="h-9 w-9 shrink-0 rounded-full bg-ink text-center text-xs leading-9 font-extrabold text-paper">
            you
          </span>
          <span className="min-w-0">
            <span className="block h-2 w-20 rounded-full bg-ink/15" />
            <span className="mt-1.5 block h-2 w-12 rounded-full bg-ink/10" />
          </span>
          <span className="ml-auto shrink-0 rounded-full bg-paper-dim px-2 py-0.5 text-[10px] font-bold text-ink">
            Scheduled
          </span>
        </div>
        <div className="mt-3 space-y-1.5">
          <span className="block h-2 rounded-full bg-ink/10" />
          <span className="block h-2 w-11/12 rounded-full bg-ink/10" />
          <span className="block h-2 w-2/3 rounded-full bg-ink/10" />
        </div>
        <div className="relative mt-3 h-28 overflow-hidden rounded-xl bg-[#D7E8F2]">
          <span className="absolute top-3 right-3 h-6 w-6 rounded-full bg-bolt" />
          <span className="absolute bottom-4 left-3 h-3 w-16 rounded-full bg-white/90" />
          <span className="absolute bottom-7 left-7 h-3 w-10 rounded-full bg-white/70" />
        </div>
        <div className="mt-3 flex items-center">
          {DOCK.map((p, i) => (
            <span key={p} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: DOCK.length - i }}>
              <BrandIcon provider={p} className="h-5 w-5" />
            </span>
          ))}
          <span className="ml-auto text-[10px] font-bold text-faint">9:00 AM</span>
        </div>
      </div>
    </div>
  );
}

function QueueCard() {
  const rows = ['9:00', '12:30', '18:00'];
  return (
    <div className="animate-float w-44 -rotate-7 rounded-2xl border border-line bg-card p-4 shadow-[0_32px_70px_-32px_rgba(28,26,20,0.4)]">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-extrabold tracking-tight">Queue</p>
        <span className="pill bg-paper-dim text-ink">4</span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((t) => (
          <div key={t} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-ink/20" />
            <span className="h-2 flex-1 rounded-full bg-ink/10" />
            <span className="text-[10px] font-bold tabular-nums text-faint">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostedCard() {
  const bars = [8, 14, 11, 20, 26];
  return (
    <div
      className="animate-float w-44 rotate-6 rounded-2xl border border-line bg-card p-4 shadow-[0_32px_70px_-32px_rgba(28,26,20,0.4)] [animation-delay:1.4s] [animation-duration:6s]"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bolt">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m3.5 8.5 3 3 6-7" stroke="#1C1A14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>
          <span className="block font-display text-sm font-extrabold tracking-tight">Posted</span>
          <span className="block text-[10px] font-bold text-faint">10 channels · just now</span>
        </span>
      </div>
      <div className="mt-3 flex h-8 items-end gap-1.5" aria-hidden="true">
        {bars.map((h, i) => (
          <span
            key={i}
            className={`w-full rounded-sm ${i === bars.length - 1 ? 'bg-bolt' : 'bg-ink/10'}`}
            style={{ height: h }}
          />
        ))}
      </div>
    </div>
  );
}

function Scene() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md select-none">
      {/* warm ground blob */}
      <div className="absolute top-1/2 left-1/2 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-soft" />
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center">
        <div className="z-0 -mr-9 justify-self-end"><QueueCard /></div>
        <Phone />
        <div className="z-0 -ml-9 justify-self-start"><PostedCard /></div>
      </div>
    </div>
  );
}

export default function Hero() {
  const [auth, setAuth] = useState<null | 'in' | 'up'>(null);

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pt-16 pb-20 md:pt-24 md:pb-28 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="text-center lg:text-left">
          <p className="eyebrow animate-rise-1">Sosial for creators</p>
          <h1 className="animate-rise-1 mt-3 font-display text-5xl leading-[1.02] font-extrabold tracking-tight text-balance md:text-6xl">
            Every channel, posted on time.
          </h1>
          <p className="animate-rise-1 mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg lg:mx-0">
            One composer and one shared calendar for ten networks. AI drafts, teammate
            approvals, and a queue that runs itself while you sleep.
          </p>
          <div className="animate-rise-2 mt-8 flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
            <button type="button" onClick={() => setAuth('up')} className="btn btn-bolt btn-lg">
              Start scheduling free →
            </button>
            <Link href="/pricing" className="btn btn-ghost btn-lg">
              See pricing
            </Link>
          </div>
          <p className="animate-rise-2 mt-4 text-xs text-faint">
            Free plan, no credit card. Cancel anytime.
          </p>
        </div>
        <div className="animate-rise-2">
          <Scene />
        </div>
      </div>
      <AuthModal open={auth !== null} mode={auth ?? 'up'} onClose={() => setAuth(null)} />
    </section>
  );
}
