'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type Range = '7D' | '30D' | '90D';

const RANGES: Range[] = ['7D', '30D', '90D'];

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Analytics snapshot: sent posts per day (7D/30D) or per week (90D).
 * Tabs switch the range — the card is alive, not a picture.
 */
export default function AnalyticsCard({ sentAt }: { sentAt: string[] }) {
  const [range, setRange] = useState<Range>('7D');

  const buckets = useMemo(() => {
    const now = startOfDay(new Date());
    if (range === '90D') {
      const out: { label: string; count: number }[] = [];
      for (let w = 12; w >= 0; w--) {
        const start = new Date(now);
        start.setDate(start.getDate() - w * 7 - 6);
        const end = new Date(now);
        end.setDate(end.getDate() - w * 7);
        end.setHours(23, 59, 59, 999);
        const count = sentAt.filter((iso) => {
          const t = new Date(iso).getTime();
          return t >= start.getTime() && t <= end.getTime();
        }).length;
        out.push({
          label: `${start.getMonth() + 1}/${start.getDate()}`,
          count,
        });
      }
      return { bars: out, caption: 'Posts sent per week, last 90 days.' };
    }
    const days = range === '7D' ? 7 : 30;
    const counts = new Map<string, number>();
    for (const iso of sentAt) {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKeyLocal(d);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const out: { label: string; count: number; isToday: boolean }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      out.push({
        label: String(d.getDate()),
        count: counts.get(dayKeyLocal(d)) ?? 0,
        isToday: i === 0,
      });
    }
    return {
      bars: out,
      caption: `Posts sent per day, last ${days} days.`,
    };
  }, [range, sentAt]);

  const max = Math.max(1, ...buckets.bars.map((b) => b.count));

  return (
    <section className="card p-5" aria-label="Analytics overview">
      <div className="flex items-center justify-between">
        <p className="font-display text-base font-extrabold tracking-tight">Analytics Overview</p>
        <Link href="/analytics" className="text-xs font-bold text-ink hover:underline">
          View all
        </Link>
      </div>
      <div className="mt-3 flex gap-1.5" role="group" aria-label="Range">
        {RANGES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setRange(t)}
            aria-pressed={range === t}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition ${
              range === t ? 'bg-accent-soft text-accent-ink' : 'bg-paper-dim text-muted hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-4 flex h-28 items-end gap-1" aria-hidden="true">
        {buckets.bars.map((b, i) => (
          <div
            key={`${b.label}-${i}`}
            className={`w-full rounded-md ${'isToday' in b && b.isToday ? 'bg-accent' : 'bg-ink/80'}`}
            style={{ height: `${b.count === 0 ? 6 : Math.max(12, Math.round((b.count / max) * 100))}%` }}
            title={`${b.count} sent`}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-faint">{buckets.caption}</p>
    </section>
  );
}
