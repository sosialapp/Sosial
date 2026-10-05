'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import { SourceMark } from '@/components/SourceMarks';

/**
 * Logo dock (GreenSock macOS-dock pen, calmed down): channel + integration
 * icons magnify gently as the cursor travels each strip — wide falloff,
 * small boost, slow ease, so hovering never feels twitchy. Static rows
 * under reduced motion and touch. Two labeled panels side by side on
 * desktop (Integrate | Channels), stacked on mobile.
 */

const CHANNELS: BrandProvider[] = [
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
  'telegram',
  'discord',
  'wordpress',
  'devto',
  'hashnode',
  'ghost',
  'vk',
  'reddit',
  'gmb',
];

const INTEGRATIONS = ['canva', 'unsplash', 'drive', 'gphotos', 'dropbox', 'onedrive'] as const;

const RANGE = 180;
const BOOST = 0.35;

function magnify(track: HTMLDivElement | null): () => void {
  if (!track) return () => {};
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const icons = Array.from(track.children) as HTMLElement[];
  gsap.set(icons, { transformOrigin: '50% 100%' });
  const onMove = (e: MouseEvent) => {
    const mx = e.clientX;
    icons.forEach((el) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(mx - (r.left + r.width / 2));
      const t = Math.max(0, 1 - d / RANGE);
      const eased = t * t;
      gsap.to(el, {
        scale: 1 + BOOST * eased,
        y: -10 * eased,
        duration: 0.5,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    });
  };
  const onLeave = () => {
    gsap.to(icons, { scale: 1, y: 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
  };
  track.addEventListener('mousemove', onMove);
  track.addEventListener('mouseleave', onLeave);
  return () => {
    track.removeEventListener('mousemove', onMove);
    track.removeEventListener('mouseleave', onLeave);
  };
}

export default function LogoDock() {
  const channelsRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanups = [magnify(channelsRef.current), magnify(toolsRef.current)];
    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <section aria-label="Channels and integrations" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 pt-12 md:pt-16">
        <div className="flex justify-center">
          <div className="flex flex-col items-stretch gap-4 rounded-[28px] border border-line bg-white/70 px-8 py-5 backdrop-blur-sm md:flex-row md:items-center">
            {/* Integrate — media sources that feed the composer */}
            <div className="flex flex-col">
              <p className="mb-3 text-center text-[11px] font-extrabold tracking-[0.18em] text-faint uppercase">
                Integrate
              </p>
              <div
                ref={toolsRef}
                className="flex flex-wrap items-end justify-center gap-3 sm:gap-4"
              >
                {INTEGRATIONS.map((t) => (
                  <span key={t} className="block shrink-0 will-change-transform" title={t}>
                    <SourceMark id={t} className="block h-9 w-9 sm:h-12 sm:w-12 [&_svg]:h-full [&_svg]:w-full" />
                  </span>
                ))}
              </div>
            </div>

            {/* Divider: vertical on desktop, horizontal on mobile */}
            <div className="mx-auto h-px w-24 shrink-0 bg-line md:mx-0 md:h-24 md:w-px md:self-center" aria-hidden="true" />

            {/* Channels — where posts land */}
            <div className="flex flex-col">
              <p className="mb-3 text-center text-[11px] font-extrabold tracking-[0.18em] text-faint uppercase">
                Channels
              </p>
              {/* Two centered rows everywhere (10 + 9 on desktop): a single strip of
                  19 never fit gracefully. The hover dock still works on wrapped
                  rows; touch and reduced-motion stay static. */}
              <div className="flex justify-center">
                <div
                  ref={channelsRef}
                  className="flex max-w-[688px] flex-wrap items-end justify-center gap-3 sm:gap-4"
                >
                  {CHANNELS.map((c) => (
                    <span key={c} className="block shrink-0 will-change-transform">
                      <BrandIcon provider={c} className="h-9 w-9 sm:h-12 sm:w-12" />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
