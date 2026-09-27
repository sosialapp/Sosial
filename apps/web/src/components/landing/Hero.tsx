'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandIcon } from '@/components/BrandIcon';
import AuthModal from '@/components/site/AuthModal';
import type { ProviderKey } from '@/lib/types';

/**
 * Fold (Tenner architecture, Sosial brand): powder-sky full screen, bolt sun
 * and white clouds, kicker pill, headline with a rotated highlight word,
 * dual CTAs, proof checklist, and the CSS device stack (phone running a
 * scheduled post flanked by queue + posted cards). No raster, no stock.
 */

const DOCK: ProviderKey[] = ['threads', 'instagram', 'tiktok', 'x'];

function Check({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#1C1A14" />
      <path d="M8 12.5l2.5 2.5L16 9.5" stroke="#FFC62E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Phone() {
  return (
    <div className="relative z-10 mx-auto w-56 rounded-[2.6rem] border-2 border-ink bg-ink p-2 shadow-[0_44px_90px_-32px_rgba(28,26,20,0.5)]">
      <div className="overflow-hidden rounded-[2rem] bg-paper px-4 pt-3 pb-4">
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
    <div className="animate-float w-44 -rotate-7 rounded-2xl border-2 border-ink bg-card p-4 shadow-[0_32px_70px_-32px_rgba(28,26,20,0.4)]">
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
    <div className="animate-float w-44 rotate-6 rounded-2xl border-2 border-ink bg-card p-4 shadow-[0_32px_70px_-32px_rgba(28,26,20,0.4)] [animation-delay:1.4s] [animation-duration:6s]">
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

const btn =
  'inline-flex items-center justify-center gap-2.5 rounded-full border-2 border-ink font-display text-base font-semibold px-6 py-3.5 leading-none transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_0_-2px_rgba(28,26,20,0.18)]';

export default function Hero() {
  const [auth, setAuth] = useState<null | 'in' | 'up'>(null);

  return (
    <section className="relative overflow-hidden bg-[#D7E8F2]">
      {/* sun + clouds */}
      <span aria-hidden="true" className="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-bolt" />
      <span aria-hidden="true" className="absolute bottom-24 -left-12 h-14 w-52 rounded-full bg-white/90">
        <span className="absolute top-[-22px] left-10 h-16 w-16 rounded-full bg-white/90" />
        <span className="absolute top-[-34px] left-24 h-20 w-20 rounded-full bg-white/90" />
      </span>
      <span aria-hidden="true" className="absolute top-24 right-[8%] h-10 w-36 rounded-full bg-white/70">
        <span className="absolute top-[-18px] left-6 h-12 w-12 rounded-full bg-white/70" />
        <span className="absolute top-[-26px] left-16 h-16 w-16 rounded-full bg-white/70" />
      </span>

      <div className="relative z-[2] mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="text-center lg:text-left">
          <span className="animate-rise-1 inline-flex items-center gap-2 rounded-full border-[1.5px] border-ink bg-white px-3.5 py-1.5 font-display text-sm font-semibold">
            <i className="h-2 w-2 rounded-full bg-bolt" aria-hidden="true" />
            One calendar for ten networks
          </span>
          <h1 className="animate-rise-1 mt-5 font-display text-5xl leading-[1.02] font-semibold tracking-tight text-balance md:text-6xl">
            Every channel, posted{' '}
            <span className="mr-1 inline-block rotate-[-2deg] rounded-[0.45em] bg-bolt px-[0.28em] leading-[1.05]">
              on time.
            </span>
          </h1>
          <p className="animate-rise-1 mx-auto mt-5 max-w-xl text-base leading-relaxed md:text-lg lg:mx-0">
            One composer and one shared calendar for ten networks. AI drafts, teammate
            approvals, and a queue that runs itself while you sleep.
          </p>
          <div className="animate-rise-2 mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <button type="button" onClick={() => setAuth('up')} className={`${btn} bg-ink text-paper`}>
              Start scheduling free
              <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <Link href="/pricing" className={`${btn} bg-white text-ink`}>
              See pricing
            </Link>
          </div>
          <ul className="animate-rise-2 mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium lg:justify-start">
            {['Free plan, no credit card', 'Ten networks, native previews', 'Cancel anytime, keep your data'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="animate-rise-2 relative mx-auto w-full max-w-md select-none" aria-label="Sosial queue and scheduled post">
          <div className="relative grid grid-cols-[1fr_auto_1fr] items-center">
            <div className="z-0 -mr-9 justify-self-end"><QueueCard /></div>
            <Phone />
            <div className="z-0 -ml-9 justify-self-start"><PostedCard /></div>
          </div>
        </div>
      </div>
      <AuthModal open={auth !== null} mode={auth ?? 'up'} onClose={() => setAuth(null)} />
    </section>
  );
}
