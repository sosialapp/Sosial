'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandIcon } from '@/components/BrandIcon';
import AuthModal from '@/components/site/AuthModal';
import type { ProviderKey } from '@/lib/types';

/**
 * Split-studio hero (Later register): sentence-case headline left, the
 * product itself right — a CSS-composed week + queue, no floating tiles,
 * no stock imagery. Two CTAs: filled accent + outlined ghost.
 * Palette is strictly the Sosial tokens (paper, ink, bolt, line).
 */

const WEEK: { day: string; chips: { label: string; hot?: boolean }[] }[] = [
  { day: 'M', chips: [{ label: '9:00' }] },
  { day: 'T', chips: [{ label: '12:30' }, { label: '18:00' }] },
  { day: 'W', chips: [] },
  { day: 'T', chips: [{ label: '9:00', hot: true }] },
  { day: 'F', chips: [{ label: '15:45' }] },
];

const QUEUE: { title: string; status: 'Queued' | 'Sent' }[] = [
  { title: 'Launch teaser', status: 'Queued' },
  { title: 'Roundup video', status: 'Sent' },
];

const DOCK: ProviderKey[] = ['threads', 'instagram', 'tiktok', 'x'];

function ProductVisual() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
      {/* week card */}
      <div className="card p-5 shadow-[0_32px_70px_-32px_rgba(28,26,20,0.35)]">
        <div className="flex items-center justify-between">
          <p className="font-display text-sm font-extrabold tracking-tight">This week</p>
          <span className="pill bg-paper-dim text-ink">4 queued</span>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {WEEK.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-bold text-faint">{d.day}</span>
              {d.chips.length === 0 ? (
                <span className="h-6" />
              ) : (
                d.chips.map((c, j) => (
                  <span
                    key={j}
                    className={`w-full rounded-md px-1 py-1 text-center text-[10px] font-bold tabular-nums ${
                      c.hot ? 'bg-ink text-paper' : 'border border-line bg-paper text-soft'
                    }`}
                  >
                    {c.label}
                  </span>
                ))
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-1.5">
          {DOCK.map((p) => (
            <span
              key={p}
              className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full"
              style={{ marginLeft: p === DOCK[0] ? 0 : -6 }}
            >
              <BrandIcon provider={p} mono className="h-4 w-4 text-soft" />
            </span>
          ))}
          <span className="ml-1 text-[11px] font-bold text-faint">10 networks</span>
        </div>
      </div>
      {/* queue card, overlapping */}
      <div className="card -mt-5 ml-10 p-4 shadow-[0_32px_70px_-32px_rgba(28,26,20,0.35)]">
        {QUEUE.map((q) => (
          <div
            key={q.title}
            className="flex items-center justify-between gap-3 border-b border-line-soft py-2 first:pt-0 last:border-b-0 last:pb-0"
          >
            <span className="truncate text-xs font-semibold text-soft">{q.title}</span>
            <span
              className={`pill shrink-0 ${
                q.status === 'Sent' ? 'bg-bolt font-bold text-ink' : 'bg-paper-dim text-ink'
              }`}
            >
              {q.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Hero() {
  const [auth, setAuth] = useState<null | 'in' | 'up'>(null);

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pt-16 pb-20 md:pt-24 md:pb-28 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="text-center lg:text-left">
          <p className="eyebrow animate-rise-1">Sosial for creators</p>
          <h1 className="animate-rise-1 mt-3 font-display text-5xl leading-[1.02] font-extrabold tracking-tight text-balance md:text-6xl">
            Every channel, posted on time.
          </h1>
          <p className="animate-rise-1 mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg lg:mx-0">
            One composer and one shared calendar for ten networks. AI drafts, teammate
            approvals, and a queue that runs itself while you sleep.
          </p>
          <div className="animate-rise-2 mt-8 flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
            <button type="button" onClick={() => setAuth('up')} className="btn btn-bolt btn-lg">
              Start scheduling free →
            </button>
            <Link href="/pricing" className="btn btn-ghost btn-lg">
              See pricing
            </Link>
          </div>
          <p className="animate-rise-2 mt-4 text-xs text-faint">
            Free plan, no credit card. Cancel anytime.
          </p>
        </div>
        <div className="animate-rise-2">
          <ProductVisual />
        </div>
      </div>
      <AuthModal open={auth !== null} mode={auth ?? 'up'} onClose={() => setAuth(null)} />
    </section>
  );
}
