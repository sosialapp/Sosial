'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

/** Weekly sends bar chart (client-only — recharts measures the DOM). */
export default function WeeklyChart({
  weeks,
  weekMax,
}: {
  weeks: { label: string; count: number }[];
  weekMax: number;
}) {
  return (
    <ChartContainer className="h-44">
      <BarChart data={weeks} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval={0}
          tick={{ fill: 'var(--color-faint)', fontSize: 10 }}
        />
        <YAxis hide domain={[0, weekMax]} />
        <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v} sent`} />} />
        <Bar dataKey="count" fill="var(--color-bolt)" radius={[6, 6, 0, 0]} maxBarSize={40} minPointSize={4} />
      </BarChart>
    </ChartContainer>
  );
}
