'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { BrandIcon } from '@/components/BrandIcon';
import type { ProviderKey } from '@/lib/types';

/**
 * Centered hero with a living logo field: tiles pop in with GSAP, drift on
 * CSS float, and parallax against the cursor at different depths. No-JS
 * floor is the same layout, static.
 */

const FLOATERS: {
  key: ProviderKey;
  pos: string;
  show: string;
  box: string;
  icon: string;
  delay: string;
  dur: string;
  depth: number;
}[] = [
  { key: 'instagram', pos: 'left-[1%] top-[12%]', show: 'hidden sm:block', box: 'h-20 w-20', icon: 'h-9 w-9', delay: '0s', dur: '5s', depth: 34 },
  { key: 'x', pos: 'left-[21%] top-[4%]', show: 'hidden md:block', box: 'h-16 w-16', icon: 'h-7 w-7', delay: '0.8s', dur: '6s', depth: 20 },
  { key: 'youtube', pos: 'left-[1%] top-[31%]', show: 'hidden sm:block', box: 'h-20 w-20', icon: 'h-9 w-9', delay: '1.6s', dur: '5.4s', depth: 26 },
  { key: 'linkedin', pos: 'left-[7%] top-[55%]', show: 'hidden md:block', box: 'h-16 w-16', icon: 'h-7 w-7', delay: '2.2s', dur: '6.2s', depth: 14 },
  { key: 'tiktok', pos: 'left-[15%] top-[80%]', show: 'hidden sm:block', box: 'h-20 w-20', icon: 'h-9 w-9', delay: '0.4s', dur: '5.6s', depth: 30 },
  { key: 'bluesky', pos: 'right-[1%] top-[6%]', show: 'hidden sm:block', box: 'h-20 w-20', icon: 'h-9 w-9', delay: '1.1s', dur: '5.2s', depth: 34 },
  { key: 'pinterest', pos: 'right-[1%] top-[23%]', show: 'hidden md:block', box: 'h-16 w-16', icon: 'h-7 w-7', delay: '2.8s', dur: '6.4s', depth: 20 },
  { key: 'threads', pos: 'right-[14%] top-[43%]', show: 'hidden md:block', box: 'h-20 w-20', icon: 'h-9 w-9', delay: '0.2s', dur: '5.8s', depth: 26 },
  { key: 'facebook', pos: 'right-[5%] top-[61%]', show: 'hidden sm:block', box: 'h-20 w-20', icon: 'h-9 w-9', delay: '1.9s', dur: '5s', depth: 30 },
  { key: 'mastodon', pos: 'right-[15%] top-[80%]', show: 'hidden md:block', box: 'h-16 w-16', icon: 'h-7 w-7', delay: '3.1s', dur: '6s', depth: 14 },
];

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const tiles = useRef<(HTMLSpanElement | null)[]>([]);
  const movers = useRef<{ x: (v: number) => void; y: (v: number) => void }[]>([]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.hero-tile', {
          scale: 0,
          autoAlpha: 0,
          duration: 0.7,
          ease: 'back.out(1.5)',
          stagger: 0.06,
          delay: 0.2,
          clearProps: 'all',
        });
        movers.current = tiles.current.map((el) =>
          el
            ? {
                x: gsap.quickTo(el, 'x', { duration: 0.7, ease: 'power3' }),
                y: gsap.quickTo(el, 'y', { duration: 0.7, ease: 'power3' }),
              }
            : { x: () => {}, y: () => {} },
        );
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      onMouseMove={(e) => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const r = root.current?.getBoundingClientRect();
        if (!r) return;
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        movers.current.forEach((m, i) => {
          const d = FLOATERS[i]?.depth ?? 20;
          m.x(px * d);
          m.y(py * d);
        });
      }}
      onMouseLeave={() =>
        movers.current.forEach((m) => {
          m.x(0);
          m.y(0);
        })
      }
      className="hero-grid relative overflow-hidden"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {FLOATERS.map((f, i) => (
          <span
            key={f.key}
            ref={(el) => {
              tiles.current[i] = el;
            }}
            className={`absolute ${f.pos} ${f.show}`}
          >
            <span className="animate-float block" style={{ animationDelay: f.delay, animationDuration: f.dur }}>
              <span
                className={`hero-tile flex items-center justify-center rounded-3xl border border-line bg-white shadow-[0_20px_50px_-20px_rgba(28,25,23,0.45)] ${f.box}`}
              >
                <BrandIcon provider={f.key} className={f.icon} />
              </span>
            </span>
          </span>
        ))}
      </div>

      <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-16 text-center md:pb-28 md:pt-24">
        <Link
          href="#teams"
          className="pill animate-rise bg-card text-soft ring-1 ring-line transition hover:bg-paper"
        >
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent" />
          New: team approvals
        </Link>
        <h1 className="animate-rise-1 mt-6 font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">
          Plan it. Write it. Post it.
          <br />
          <span className="text-accent">To your social media.</span>
        </h1>
        <p className="animate-rise-1 mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
          One composer and one shared calendar for ten networks — with an AI writer, approvals
          and a queue that runs itself.
        </p>
        <div className="animate-rise-2 mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <Link href="/login" className="btn btn-primary btn-lg">
            Start scheduling free
            <span aria-hidden="true">→</span>
          </Link>
          <a href="#channels" className="btn btn-ghost btn-lg">
            Try the composer
          </a>
        </div>
        <p className="animate-rise-3 mt-4 text-xs text-faint">
          Free forever plan · No credit card · iOS, Android &amp; web
        </p>
      </div>
    </section>
  );
}
