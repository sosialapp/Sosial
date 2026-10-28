'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';
import { TOURS, storageKey, tourFor, type TourId, type TourStep } from './steps';

/**
 * Page walkthrough: dims the screen, rings one element and explains it in a
 * card. Four hops at most, once per page per device (localStorage), skipped
 * with Esc or the Skip button. Settings can replay it.
 *
 * Targets are plain `[data-tour="..."]` attributes, so the copy lives here and
 * the pages only carry a name. A step whose element is not on screen right now
 * is dropped instead of pointing at nothing.
 */

type Rect = { top: number; left: number; width: number; height: number };

const RING_PAD = 8;
const CARD_W = 312;
const EDGE = 16;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export default function Tour() {
  const pathname = usePathname();
  const t = useT(appMessages);
  const [tour, setTour] = useState<TourId | null>(null);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = tour ? steps[index] : undefined;

  const finish = useCallback(
    (markSeen: boolean) => {
      if (tour && markSeen) {
        try {
          window.localStorage.setItem(storageKey(tour), '1');
        } catch {
          /* private mode */
        }
      }
      setTour(null);
      setSteps([]);
      setIndex(0);
      setRect(null);
    },
    [tour],
  );

  const begin = useCallback((id: TourId) => {
    const present = TOURS[id].filter((s) => document.querySelector(`[data-tour="${s.target}"]`));
    if (!present.length) return false;
    setSteps(present);
    setIndex(0);
    setRect(null);
    setTour(id);
    return true;
  }, []);

  // First visit to a page with a tour: wait for layout to settle, then walk it.
  useEffect(() => {
    const id = tourFor(pathname);
    if (!id || tour) return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(storageKey(id)) === '1';
    } catch {
      seen = true;
    }
    if (seen) return;
    const timer = window.setTimeout(() => {
      begin(id);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [pathname, tour, begin]);

  // "Show me around again" from settings: drop every flag and restart.
  useEffect(() => {
    const onReplay = () => {
      const id = tourFor(pathname);
      if (id) begin(id);
    };
    window.addEventListener('sosial:tour-replay', onReplay);
    return () => window.removeEventListener('sosial:tour-replay', onReplay);
  }, [pathname, begin]);

  // Navigating somewhere else mid-tour ends it quietly, unseen.
  useEffect(() => {
    if (tour && tourFor(pathname) !== tour) finish(false);
  }, [pathname, tour, finish]);

  // Follow the target: scroll it into view, then track it while open.
  useEffect(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    let raf = 0;
    let last = '';
    const track = () => {
      const next = rectOf(el);
      const key = `${Math.round(next.top)}:${Math.round(next.left)}:${Math.round(next.width)}:${Math.round(next.height)}`;
      if (key !== last) {
        last = key;
        setRect(next);
      }
      raf = window.requestAnimationFrame(track);
    };
    track();
    return () => window.cancelAnimationFrame(raf);
  }, [step]);

  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(true);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1 < steps.length ? i + 1 : i));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tour, steps.length, finish]);

  if (!tour || !step) return null;

  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  const last = index === steps.length - 1;

  // Card placement: right of the target when there is room, otherwise below or
  // above it, always kept inside the viewport.
  let cardTop = EDGE;
  let cardLeft = EDGE;
  if (rect) {
    const rightRoom = vw - (rect.left + rect.width) - EDGE * 2;
    const leftRoom = rect.left - EDGE * 2;
    if (rightRoom >= CARD_W) {
      cardTop = clamp(rect.top - 8, EDGE, vh - 220);
      cardLeft = rect.left + rect.width + EDGE;
    } else if (leftRoom >= CARD_W) {
      cardTop = clamp(rect.top - 8, EDGE, vh - 220);
      cardLeft = rect.left - CARD_W - EDGE;
    } else {
      const below = rect.top + rect.height + EDGE;
      cardTop = below + 210 < vh ? below : Math.max(EDGE, rect.top - 215);
      cardLeft = clamp(rect.left, EDGE, vw - CARD_W - EDGE);
    }
  } else {
    cardTop = vh / 2 - 100;
    cardLeft = vw / 2 - CARD_W / 2;
  }

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={t(step.title)}>
      {/* Blocks the page underneath: the walkthrough is the only thing to do. */}
      <div className="absolute inset-0" onClick={() => void 0} aria-hidden="true" />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-accent transition-[top,left,width,height] duration-200 ease-out"
          style={{
            top: rect.top - RING_PAD,
            left: rect.left - RING_PAD,
            width: rect.width + RING_PAD * 2,
            height: rect.height + RING_PAD * 2,
            boxShadow: '0 0 0 9999px rgba(11,18,32,0.55)',
          }}
          aria-hidden="true"
        />
      ) : (
        <div className="absolute inset-0 bg-[#0b1220]/55" aria-hidden="true" />
      )}
      <div
        className="absolute w-[312px] rounded-2xl border border-line bg-card p-4 shadow-[0_24px_60px_-16px_rgba(25,21,18,0.55)]"
        style={{ top: cardTop, left: cardLeft }}
        aria-live="polite"
      >
        <p className="eyebrow mb-1.5">
          {t('tourOf').replace('{n}', String(index + 1)).replace('{total}', String(steps.length))}
        </p>
        <p className="text-[15px] font-extrabold leading-snug">{t(step.title)}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-soft">{t(step.body)}</p>
        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => finish(true)}
            className="rounded-lg px-2 py-1.5 text-[13px] font-semibold text-muted transition hover:text-ink"
          >
            {t('tourSkip')}
          </button>
          <span className="flex-1" />
          {index > 0 ? (
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-semibold text-soft transition hover:bg-bone"
            >
              {t('tourBack')}
            </button>
          ) : null}
          <button
            type="button"
            autoFocus
            onClick={() => (last ? finish(true) : setIndex((i) => i + 1))}
            className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-bold text-[#0b1220] transition hover:bg-accent-bright"
          >
            {last ? t('tourDone') : t('tourNext')}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-1" aria-hidden="true">
          {steps.map((s, i) => (
            <span
              key={s.target}
              className={`h-1 rounded-full transition-all ${i === index ? 'w-4 bg-accent' : 'w-1 bg-line'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}