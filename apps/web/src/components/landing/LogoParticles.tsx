'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { BRAND_PATHS, brandColor, type BrandProvider } from '@/components/BrandIcon';
import type { ProviderKey } from '@/lib/types';

/**
 * Ambient social-logo particles (GSAP canvas-pen method): the ten channel
 * discs rasterized once to sprites, then drifted, twinkled and gently pushed
 * around the cursor on a GSAP ticker. Decorative — static frame under
 * reduced motion, nothing rendered server-side.
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

const SPRITE = 128;

function spriteSvg(provider: ProviderKey): string {
  const d = BRAND_PATHS[provider as BrandProvider];
  const glyph = `<g transform="translate(28 28) scale(1.6667)"><path d="${d}" fill="#ffffff"/></g>`;
  const disc =
    provider === 'instagram'
      ? `<defs><radialGradient id="socig" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="#FDF497"/><stop offset="5%" stop-color="#FDF497"/><stop offset="45%" stop-color="#FD5949"/><stop offset="60%" stop-color="#D6249F"/><stop offset="90%" stop-color="#285AEB"/></radialGradient></defs><circle cx="48" cy="48" r="48" fill="url(#socig)"/>`
      : `<circle cx="48" cy="48" r="48" fill="${brandColor(provider as BrandProvider)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">${disc}${glyph}</svg>`;
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
  sprite: HTMLCanvasElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  spin: number;
  rot: number;
  alpha: number;
}

export default function LogoParticles({ density = 1 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let dead = false;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mouse = { x: -9999, y: -9999 };
    const parent = canvas.parentElement;

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    parent?.addEventListener('pointermove', onMove, { passive: true });
    parent?.addEventListener('pointerleave', onLeave);

    const fit = () => {
      const r = parent?.getBoundingClientRect();
      const w = Math.max(1, Math.round(r?.width ?? window.innerWidth));
      const h = Math.max(1, Math.round(r?.height ?? 600));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    };
    let { w, h } = fit();

    const spawn = (sprites: HTMLCanvasElement[]): P[] => {
      const n = Math.max(12, Math.min(30, Math.round(((w * h) / 42000) * density)));
      return Array.from({ length: n }, (_, i) => ({
        sprite: sprites[i % sprites.length],
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 10,
        vy: -4 - Math.random() * 8,
        size: 20 + Math.random() * 28,
        phase: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.25,
        rot: (Math.random() - 0.5) * 0.5,
        alpha: 0.3 + Math.random() * 0.4,
      }));
    };

    const draw = (ps: P[], t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        const tw = 0.72 + 0.28 * Math.sin(t / 900 + p.phase);
        ctx.save();
        ctx.globalAlpha = p.alpha * tw;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    };

    let parts: P[] = [];
    let tick: ((time: number, deltaMS: number) => void) | null = null;
    void Promise.all(LOGOS.map((p) => rasterize(spriteSvg(p)))).then((sprites) => {
      if (dead) return;
      parts = spawn(sprites);
      if (reduced) {
        draw(parts, 0);
        return;
      }
      // GSAP-ticker loop, pen-style: steer, wrap, draw.
      tick = (_time: number, deltaMS: number) => {
        const dt = Math.min(0.05, deltaMS / 1000);
        const t = performance.now();
        for (const p of parts) {
          p.x += (p.vx + Math.sin(t / 2400 + p.phase) * 6) * dt;
          p.y += p.vy * dt;
          p.rot += p.spin * dt;
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 150 * 150 && d2 > 1) {
            const d = Math.sqrt(d2);
            const push = ((150 - d) / 150) * 130 * dt;
            p.x += (dx / d) * push;
            p.y += (dy / d) * push;
          }
          const m = 60;
          if (p.y < -m) {
            p.y = h + m;
            p.x = Math.random() * w;
          }
          if (p.x < -m) p.x = w + m;
          if (p.x > w + m) p.x = -m;
        }
        draw(parts, t);
      };
      if (tick) gsap.ticker.add(tick);
    });

    const onResize = () => {
      const next = fit();
      w = next.w;
      h = next.h;
    };
    window.addEventListener('resize', onResize);

    return () => {
      dead = true;
      window.removeEventListener('resize', onResize);
      parent?.removeEventListener('pointermove', onMove);
      parent?.removeEventListener('pointerleave', onLeave);
      if (tick) gsap.ticker.remove(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}
