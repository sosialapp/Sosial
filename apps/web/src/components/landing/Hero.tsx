'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { BrandIcon } from '@/components/BrandIcon';
import AuthModal from '@/components/site/AuthModal';
import type { ProviderKey } from '@/lib/types';

/**
 * Centered hero with a living logo field. Every tile drifts on a CSS float,
 * parallaxes against the cursor, and — on a staggered cycle — flips on both
 * axes into the *next* brand. Each tile walks the full provider list in order
 * (offset by its own index), so within one cycle no box ever repeats a logo,
 * and no two boxes show the same brand at the same step.
 */

const PROVIDERS: ProviderKey[] = [
  'instagram',
  'x',
  'youtube',
  'linkedin',
  'tiktok',
  'bluesky',
  'pinterest',
  'threads',
  'facebook',
  'mastodon',
];

const FLOATERS: {
  pos: string;
  show: string;
  box: string;
  icon: string;
  delay: string;
  dur: string;
  depth: number;
}[] = [
  { pos: 'left-[5%] top-[14%]', show: 'hidden sm:block', box: 'h-20 w-20', icon: 'h-9 w-9', delay: '0s', dur: '5s', depth: 34 },
  { pos: 'left-[23%] top-[7%]', show: 'hidden md:block', box: 'h-16 w-16', icon: 'h-7 w-7', delay: '0.8s', dur: '6s', depth: 20 },
  { pos: 'left-[5%] top-[33%]', show: 'hidden sm:block', box: 'h-20 w-20', icon: 'h-9 w-9', delay: '1.6s', dur: '5.4s', depth: 26 },
  { pos: 'left-[10%] top-[56%]', show: 'hidden md:block', box: 'h-16 w-16', icon: 'h-7 w-7', delay: '2.2s', dur: '6.2s', depth: 14 },
  { pos: 'left-[17%] top-[76%]', show: 'hidden sm:block', box: 'h-20 w-20', icon: 'h-9 w-9', delay: '0.4s', dur: '5.6s', depth: 30 },
  { pos: 'right-[5%] top-[9%]', show: 'hidden sm:block', box: 'h-20 w-20', icon: 'h-9 w-9', delay: '1.1s', dur: '5.2s', depth: 34 },
  { pos: 'right-[5%] top-[25%]', show: 'hidden md:block', box: 'h-16 w-16', icon: 'h-7 w-7', delay: '2.8s', dur: '6.4s', depth: 20 },
  { pos: 'right-[16%] top-[45%]', show: 'hidden md:block', box: 'h-20 w-20', icon: 'h-9 w-9', delay: '0.2s', dur: '5.8s', depth: 26 },
  { pos: 'right-[8%] top-[62%]', show: 'hidden sm:block', box: 'h-20 w-20', icon: 'h-9 w-9', delay: '1.9s', dur: '5s', depth: 30 },
  { pos: 'right-[17%] top-[76%]', show: 'hidden md:block', box: 'h-16 w-16', icon: 'h-7 w-7', delay: '3.1s', dur: '6s', depth: 14 },
];

/** Seconds between one tile's flips (also the full-cycle length of its loop). */
const FLIP_CYCLE = 3.4;
/** Stagger between tiles so they never all turn together. */
const FLIP_STAGGER = 0.3;

function FlipTile({
  providers,
  seed,
  box,
  icon,
  floatDelay,
  floatDur,
}: {
  providers: ProviderKey[];
  seed: number;
  box: string;
  icon: string;
  floatDelay: string;
  floatDur: string;
}) {
  const n = providers.length;
  const [index, setIndex] = useState(seed % n);
  const face = useRef<HTMLSpanElement>(null);
  const step = useRef(0);

  useEffect(() => {
    const el = face.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const tl = gsap.timeline({ repeat: -1, delay: 1.8 + seed * FLIP_STAGGER });
    tl.to(el, { rotateX: 90, rotateY: 90, duration: 0.34, ease: 'power2.in' })
      .call(() => {
        step.current += 1;
        setIndex((seed + step.current) % n);
      })
      // A beat to let React paint the incoming mark while the tile is edge-on.
      .to({}, { duration: 0.06 })
      .set(el, { rotateX: -90, rotateY: -90 })
      .to(el, { rotateX: 0, rotateY: 0, duration: 0.4, ease: 'power2.out' })
      .to({}, { duration: Math.max(0.2, FLIP_CYCLE - 0.8) });

    return () => {
      tl.kill();
    };
  }, [n, seed]);

  return (
    <span className="animate-float block" style={{ animationDelay: floatDelay, animationDuration: floatDur }}>
      <span className="block [perspective:900px]">
        <span
          ref={face}
          className={`hero-tile flex items-center justify-center rounded-3xl border border-line bg-paper shadow-[0_20px_50px_-20px_rgba(28,26,20,0.35)] ${box}`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <BrandIcon provider={providers[index]} className={icon} />
        </span>
      </span>
    </span>
  );
}

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const tiles = useRef<(HTMLSpanElement | null)[]>([]);
  const movers = useRef<{ x: (v: number) => void; y: (v: number) => void }[]>([]);
  const [auth, setAuth] = useState<null | 'in' | 'up'>(null);

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
            key={f.pos}
            ref={(el) => {
              tiles.current[i] = el;
            }}
            className={`absolute ${f.pos} ${f.show}`}
          >
            <FlipTile
              providers={PROVIDERS}
              seed={i}
              box={f.box}
              icon={f.icon}
              floatDelay={f.delay}
              floatDur={f.dur}
            />
          </span>
        ))}
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-16 text-center md:pb-28 md:pt-24">
        <h1 className="animate-rise-1 font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">
          Plan it. Write it. Post it.
        </h1>
        <p className="animate-rise-1 mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
          One composer and one shared calendar for ten networks, with an AI writer, approvals
          and a queue that runs itself.
        </p>
        <div className="animate-rise-2 mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <button type="button" onClick={() => setAuth('up')} className="btn btn-bolt btn-lg">
            Start scheduling free
          </button>
        </div>
        <AuthModal open={auth !== null} mode={auth ?? 'up'} onClose={() => setAuth(null)} />
      </div>
    </section>
  );
}
