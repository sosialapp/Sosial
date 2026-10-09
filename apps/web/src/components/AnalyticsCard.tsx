'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartBar } from '@/components/ui/chart';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
        out.push({ label: `${start.getMonth() + 1}/${start.getDate()}`, count });
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
    const out: { label: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      out.push({ label: String(d.getDate()), count: counts.get(dayKeyLocal(d)) ?? 0 });
    }
    return { bars: out, caption: `Posts sent per day, last ${days} days.` };
  }, [range, sentAt]);

  const max = Math.max(1, ...buckets.bars.map((b) => b.count));

  return (
    <Card aria-label="Analytics overview">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Analytics overview</CardTitle>
          <Link href="/analytics" className="text-xs font-bold text-ink hover:underline">
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList aria-label="Range">
            {RANGES.map((t) => (
              <TabsTrigger key={t} value={t}>
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="mt-4">
          <ChartBar
            data={buckets.bars}
            dataKey="count"
            labelKey="label"
            domainMax={max}
            height={132}
            formatter={(v) => `${v} sent`}
          />
        </div>
        <p className="mt-2 text-[11px] text-faint">{buckets.caption}</p>
      </CardContent>
    </Card>
  );
}
