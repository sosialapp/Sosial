'use client';

/**
 * Live product previews for the marketing site. Instead of drawn mock-ups,
 * these mount the real app components (calendar, composer, AI writer, team
 * roster) with a sample workspace, at true desktop size, then scale the
 * whole thing down to fit the column. The preview is inert: nothing inside
 * can be clicked or focused, so no request ever leaves the page.
 *
 * Mounts after hydration only: the app components are client-side and
 * date-dependent, and the server can't know the visitor's clock or locale.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';

const AppPreviewScreen = dynamic(() => import('./AppPreviewScreen'), { ssr: false });

export type PreviewScreen =
  | 'calendar-month'
  | 'calendar-list'
  | 'week'
  | 'composer'
  | 'quick-post'
  | 'ai-writer'
  | 'team';

/** `shell` frames the screen in the app's real left menu, as it sits in sosial.app. */
const SCREENS: Record<PreviewScreen, { url: string; width: number; crop?: number; shell?: boolean }> = {
  'calendar-month': { url: 'sosial.app/calendar-month', width: 1260, crop: 780, shell: true },
  'calendar-list': { url: 'sosial.app/calendar-list', width: 1000, crop: 640, shell: true },
  week: { url: 'sosial.app/dashboard', width: 1180, crop: 420 },
  composer: { url: 'sosial.app/post', width: 1260, crop: 760, shell: true },
  'quick-post': { url: 'sosial.app/dashboard', width: 560 },
  'ai-writer': { url: 'sosial.app/post', width: 460, crop: 720 },
  team: { url: 'sosial.app/team', width: 1260, crop: 680, shell: true },
};

/** Browser-window frame around a scaled, inert render of a real app screen. */
export default function AppPreview({ screen, caption }: { screen: PreviewScreen; caption?: ReactNode }) {
  const cfg = SCREENS[screen];
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const sync = () => {
      const w = box.current?.clientWidth ?? 0;
      const s = Math.min(1, w / cfg.width);
      setScale(s);
      const h = inner.current?.scrollHeight ?? 0;
      setHeight(Math.min(h, cfg.crop ?? h) * s);
    };
    sync();
    const ro = new ResizeObserver(sync);
    if (box.current) ro.observe(box.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [mounted, cfg.width, cfg.crop]);

  return (
    // Narrow screens (a single card) sit centred at their real width instead
    // of stretching the frame around empty space.
    <figure className="m-0 mx-auto" style={cfg.width < 800 ? { maxWidth: cfg.width + 2 } : undefined}>
      <div className="overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_1px_2px_rgba(28,26,20,0.06),0_24px_48px_-28px_rgba(28,26,20,0.28)]">
        <div className="flex items-center gap-3 border-b border-line bg-surface/70 px-3.5 py-2.5" aria-hidden="true">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
          </span>
          <span className="mx-auto truncate rounded-md bg-card px-3 py-0.5 font-mono text-[11px] text-faint ring-1 ring-line">
            {cfg.url}
          </span>
          <span className="w-[42px]" />
        </div>
        <div
          ref={box}
          className="relative overflow-hidden bg-bone"
          // Holds the 16:10 placeholder until the lazily loaded screen has a height,
          // so the frame never collapses to zero while its code downloads.
          style={{ height: mounted && scale && height ? height : undefined, aspectRatio: mounted && scale && height ? undefined : '16 / 10' }}
        >
          {mounted ? (
            <div
              ref={inner}
              inert
              aria-hidden="true"
              data-theme-root
              className="pointer-events-none absolute top-0 left-0 origin-top-left select-none bg-bone text-ink"
              style={{ width: cfg.width, transform: `scale(${scale || 0.0001})` }}
            >
              <AppPreviewScreen screen={screen} shell={cfg.shell} />
            </div>
          ) : null}
          {mounted && height ? null : <div className="absolute inset-0 animate-pulse bg-surface" />}
          {cfg.crop ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bone to-transparent" aria-hidden="true" />
          ) : null}
        </div>
      </div>
      {caption ? <figcaption className="mt-3 text-xs leading-relaxed text-muted">{caption}</figcaption> : null}
    </figure>
  );
}
