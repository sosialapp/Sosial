'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AuthModal from '@/components/site/AuthModal';
import LogoParticles from '@/components/landing/LogoParticles';

/**
 * Fold (Tenner architecture, Sosial brand): eyebrow, headline with a rotated
 * highlight word, dual CTAs, proof checklist, and the devices render —
 * floating over an ambient canvas of drifting social-logo particles
 * (GSAP canvas-pen method). No stock.
 */

const btn =
  'inline-flex items-center justify-center gap-2.5 rounded-full border-2 border-ink font-display text-base font-semibold px-6 py-3.5 leading-none transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_0_-2px_rgba(28,26,20,0.18)]';

export default function Hero() {
  const [auth, setAuth] = useState<null | 'in' | 'up'>(null);

  return (
    <section className="relative overflow-hidden">
      <LogoParticles />

      <div className="relative z-[2] mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="text-center lg:text-left">
          <h1 className="animate-rise-1 font-display text-5xl leading-[1.02] font-semibold tracking-tight text-balance md:text-6xl">
            Autopilot social media scheduler with{' '}
            <span className="mr-1 inline-block rotate-[-2deg] rounded-[0.45em] bg-bolt px-[0.28em] leading-[1.05]">
              AI-Written contents
            </span>
          </h1>
          <p className="animate-rise-1 mx-auto mt-5 max-w-xl text-base leading-relaxed md:text-lg lg:mx-0">
            Sosial is the AI social media scheduler with one composer and one shared
            calendar for ten networks. AI drafts your posts, your team approves them,
            and the queue publishes on its own, even while you sleep.
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
        </div>
        <div className="animate-rise-2 relative">
          <Image
            src="/hero-devices.png"
            alt="Sosial composer on a laptop beside the Sosial home screen on a phone"
            width={1540}
            height={959}
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="h-auto w-full [filter:drop-shadow(0_50px_100px_rgba(28,26,20,0.35))] lg:scale-[1.12] lg:origin-center"
          />
        </div>
      </div>
      <AuthModal open={auth !== null} mode={auth ?? 'up'} onClose={() => setAuth(null)} />
    </section>
  );
}
