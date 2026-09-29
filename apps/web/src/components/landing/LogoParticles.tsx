'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { BRAND_PATHS, brandColor, type BrandProvider } from '@/components/BrandIcon';
import type { ProviderKey } from '@/lib/types';

/**
 * Social-logo vortex — the GreenSock canvas-particles pen, reskinned: the
 * ten channel discs spiral endlessly from the edges into the center on one
 * GSAP timeline (function-based spiral origins, scale 1.1 → 0, negative
 * stagger loop, seeked mid-flight on load), sorted by scale for depth.
 * Decorative: static frame under reduced motion, nothing server-side.
 */

const LOGOS: ProviderKey[] = [
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

const COUNT = 90;
const BASE_SIZE = 192;
const DURATION = 5;
const SPRITE = 128;

function spriteSvg(provider: ProviderKey): string {
  const d = BRAND_PATHS[provider as BrandProvider];
  const fill =
    provider === 'instagram'
      ? 'url(#socig)'
      : brandColor(provider as BrandProvider);
  const defs =
    provider === 'instagram'
      ? `<defs><radialGradient id="socig" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="#FDF497"/><stop offset="5%" stop-color="#FDF497"/><stop offset="45%" stop-color="#FD5949"/><stop offset="60%" stop-color="#D6249F"/><stop offset="90%" stop-color="#285AEB"/></radialGradient></defs>`
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24">${defs}<g transform="translate(2 2) scale(0.8333)"><path d="${d}" fill="${fill}"/></g></svg>`;
}

function rasterize(svg: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = SPRITE;
      c.height = SPRITE;
      c.getContext('2d')?.drawImage(img, 0, 0, SPRITE, SPRITE);
      resolve(c);
    };
    img.onerror = () => reject(new Error('sprite failed'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

interface P {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  sprite: HTMLCanvasElement;
}

export default function LogoParticles() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const parent = canvas.parentElement;
    let dead = false;
    let tl: gsap.core.Timeline | null = null;
    let parts: P[] = [];
    let w = 1;
    let h = 1;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const fit = () => {
      const r = parent?.getBoundingClientRect();
      w = Math.max(1, Math.round(r?.width ?? window.innerWidth));
      h = Math.max(1, Math.round(r?.height ?? 600));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();

    const draw = () => {
      parts.sort((a, b) => a.scale - b.scale); // scale sets z-index, pen-style
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        const size = BASE_SIZE * p.scale;
        if (size < 0.5) continue;
        ctx.translate(w / 2, h / 2);
        ctx.rotate(p.rotate);
        ctx.drawImage(p.sprite, p.x - size / 2, p.y - size / 2, size, size);
        ctx.resetTransform();
        ctx.setTransform(
          Math.min(2, window.devicePixelRatio || 1),
          0,
          0,
          Math.min(2, window.devicePixelRatio || 1),
          0,
          0,
        );
      }
    };

    const build = (seekTo: number) => {
      tl?.kill();
      const radius = Math.max(w, h);
      tl = gsap.timeline({ onUpdate: draw }).fromTo(
        parts,
        {
          x: (i: number) => {
            const angle = (i / parts.length) * Math.PI * 2 - Math.PI / 2;
            return Math.cos(angle * 10) * radius;
          },
          y: (i: number) => {
            const angle = (i / parts.length) * Math.PI * 2 - Math.PI / 2;
            return Math.sin(angle * 10) * radius;
          },
          scale: 1.1,
          rotate: 0,
        },
        {
          duration: DURATION,
          ease: 'sine',
          x: 0,
          y: 0,
          scale: 0,
          rotate: -3,
          stagger: { each: -0.05, repeat: -1 },
        },
        0,
      );
      tl.seek(seekTo);
      if (reduced) tl.pause();
    };

    void Promise.all(LOGOS.map((p) => rasterize(spriteSvg(p)))).then((sprites) => {
      if (dead) return;
      parts = Array.from(
        { length: COUNT },
        (_, i) => ({ x: 0, y: 0, scale: 0, rotate: 0, sprite: sprites[i % sprites.length] }),
      );
      build(99);
    });

    const onResize = () => {
      fit();
      if (parts.length) build(tl ? tl.time() % (tl.duration() || 1) : 99);
    };
    window.addEventListener('resize', onResize);

    return () => {
      dead = true;
      window.removeEventListener('resize', onResize);
      tl?.kill();
      tl = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}
