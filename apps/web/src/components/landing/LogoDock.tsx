'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { BrandIcon, type BrandProvider } from '@/components/BrandIcon';

/**
 * Channel dock (GreenSock macOS-dock pen, calmed down): the ten channel
 * icons magnify gently as the cursor travels the strip — wide falloff,
 * small boost, slow ease, so hovering never feels twitchy. Static row
 * under reduced motion and touch.
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

const RANGE = 180;
const BOOST = 0.35;

export default function LogoDock() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const icons = Array.from(track.children) as HTMLElement[];
    gsap.set(icons, { transformOrigin: '50% 100%' });
    const onMove = (e: MouseEvent) => {
      const bounds = track.getBoundingClientRect();
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
  }, []);

  return (
    <section aria-label="Channels" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 pt-12 md:pt-16">
        <div className="flex justify-center">
          <div
            ref={trackRef}
            className="flex max-w-full items-end gap-2.5 overflow-x-auto rounded-[28px] border border-line bg-white/70 px-5 pt-4 pb-3 backdrop-blur-sm sm:gap-3 sm:px-6 sm:pt-5 sm:pb-4"
          >
            {CHANNELS.map((c) => (
              <span key={c} className="block shrink-0 will-change-transform">
                <BrandIcon provider={c} className="h-10 w-10 sm:h-12 sm:w-12" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
