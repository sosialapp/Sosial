'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { BrandIcon } from '@/components/BrandIcon';
import type { ProviderKey } from '@/lib/types';

const CHANNELS: ProviderKey[] = [
  'instagram',
  'tiktok',
  'x',
  'facebook',
  'threads',
  'youtube',
  'linkedin',
  'bluesky',
  'mastodon',
  'pinterest',
];

/** Falloff radius in px — wide on purpose so the swell feels calm, not twitchy. */
const RADIUS = 170;
/** Peak swell at the cursor — deliberately small. */
const PEAK = 0.32;

/**
 * One row of every channel Sosial publishes to, with the GreenSock macOS
 * dock magnification on hover: icons swell near the cursor and settle back
 * on leave. Tuned gentle (wide radius, low peak, soft ease) per request.
 * Static, fully usable row when JS or motion is off.
 */
export default function ChannelDock() {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tiles = Array.from(row.querySelectorAll<HTMLElement>('[data-dock-tile]'));
    if (!tiles.length) return;

    const settle = () =>
      gsap.to(tiles, { scale: 1, y: 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });

    const onMove = (e: MouseEvent) => {
      tiles.forEach((el) => {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(e.clientX - (r.left + r.width / 2));
        const t = Math.max(0, 1 - dist / RADIUS);
        const eased = t * t * (3 - 2 * t);
        gsap.to(el, {
          scale: 1 + PEAK * eased,
          y: -7 * eased,
          duration: 0.35,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      });
    };

    row.addEventListener('mousemove', onMove);
    row.addEventListener('mouseleave', settle);
    return () => {
      row.removeEventListener('mousemove', onMove);
      row.removeEventListener('mouseleave', settle);
    };
  }, []);

  return (
    <section aria-label="Channels" className="border-t border-line">
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:py-20">
        <p className="eyebrow text-center">Channels</p>
        <h2 className="mx-auto mt-2 max-w-xl text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          Ten channels, one workspace.
        </h2>
        <div className="mt-9 overflow-x-auto pb-4">
          <div
            ref={rowRef}
            className="mx-auto flex w-fit items-end justify-center gap-2.5 px-2 sm:gap-3"
          >
            {CHANNELS.map((p) => (
              <Link
                key={p}
                href={`/integrations/${p}`}
                data-dock-tile
                aria-label={`${p} integration`}
                title={p}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-paper shadow-[0_14px_30px_-18px_rgba(28,26,20,0.4)] sm:h-16 sm:w-16"
                style={{ transformOrigin: '50% 100%' }}
              >
                <BrandIcon provider={p} className="h-7 w-7 sm:h-8 sm:w-8" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
