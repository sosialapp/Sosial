'use client';

import dynamic from 'next/dynamic';

/** Client boundary for the DOM-measured chart (recharts can't SSR). */
const WeeklyChart = dynamic(() => import('./WeeklyChart'), {
  ssr: false,
  loading: () => <div className="h-44 animate-pulse rounded-xl bg-surface" />,
});

export default function WeeklyChartLoader({
  weeks,
  weekMax,
}: {
  weeks: { label: string; count: number }[];
  weekMax: number;
}) {
  return <WeeklyChart weeks={weeks} weekMax={weekMax} />;
}
