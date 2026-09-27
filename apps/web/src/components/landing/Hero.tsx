'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuthModal from '@/components/site/AuthModal';
import MacMockup from '@/components/landing/MacMockup';

/**
 * Fold (Tenner architecture, Sosial brand): powder-sky full screen, bolt sun
 * and white clouds, eyebrow, headline with a rotated highlight word, dual
 * CTAs, proof checklist, and a Mac mockup running a Sosial dashboard
 * snapshot. No raster, no stock.
 */

function Check({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#1C1A14" />
      <path d="M8 12.5l2.5 2.5L16 9.5" stroke="#FFC62E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

      <div className="relative z-[2] mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-10 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="text-center lg:text-left">
          <p className="eyebrow animate-rise-1">One calendar for ten networks</p>
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
        <div className="animate-rise-2">
          <MacMockup />
        </div>
      </div>
      <AuthModal open={auth !== null} mode={auth ?? 'up'} onClose={() => setAuth(null)} />
    </section>
  );
}
