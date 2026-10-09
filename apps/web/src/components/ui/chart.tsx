'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

/**
 * shadcn-style chart primitives on brand tokens. Colors resolve through the
 * app's CSS vars so charts flip with the theme automatically.
 */

/** Recharts measures the DOM, so charts mount client-side only. The wrapper
 *  keeps its explicit height during SSR, so there is no layout shift. */
function useMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

function ChartContainer({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactElement;
}) {
  const mounted = useMounted();
  return (
    <div className={cn('w-full', className)} style={style}>
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

function ChartTooltip(props: React.ComponentProps<typeof Tooltip>) {
  return <Tooltip cursor={{ fill: 'var(--color-surface)' }} {...props} />;
}

function ChartTooltipContent({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { value?: number | string; name?: string }[];
  label?: string | number;
  formatter?: (value: number | string) => string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? '';
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 shadow-[0_18px_40px_-16px_rgba(25,21,18,0.4)]">
      {label !== undefined ? <p className="text-[11px] font-bold text-muted">{label}</p> : null}
      <p className="font-display text-sm font-extrabold text-ink">
        {formatter ? formatter(v) : v}
      </p>
    </div>
  );
}

type Datum = Record<string, string | number | null>;

/** Vertical bars on a shared axis — the workhorse for per-day / per-week counts. */
function ChartBar({
  data,
  dataKey,
  labelKey,
  color = 'var(--color-bolt)',
  height = 176,
  domainMax,
  formatter,
  className,
}: {
  data: Datum[];
  dataKey: string;
  labelKey: string;
  color?: string;
  height?: number;
  domainMax?: number;
  formatter?: (value: number | string) => string;
  className?: string;
}) {
  return (
    <ChartContainer className={className} style={{ height }}>
      <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 4 }} barCategoryGap="26%">
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis
          dataKey={labelKey}
          tickLine={false}
          axisLine={false}
          interval={0}
          tick={{ fill: 'var(--color-faint)', fontSize: 10 }}
        />
        <YAxis hide domain={domainMax ? [0, domainMax] : undefined} />
        <ChartTooltip content={<ChartTooltipContent formatter={formatter} />} />
        <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={40} minPointSize={4} />
      </BarChart>
    </ChartContainer>
  );
}

/** Filled area for a running total (follower growth, cumulative sends). */
function ChartArea({
  data,
  dataKey,
  labelKey,
  color = 'var(--color-accent)',
  height = 176,
  formatter,
  className,
}: {
  data: Datum[];
  dataKey: string;
  labelKey: string;
  color?: string;
  height?: number;
  formatter?: (value: number | string) => string;
  className?: string;
}) {
  const id = React.useId();
  return (
    <ChartContainer className={className} style={{ height }}>
      <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis
          dataKey={labelKey}
          tickLine={false}
          axisLine={false}
          interval={0}
          tick={{ fill: 'var(--color-faint)', fontSize: 10 }}
        />
        <YAxis hide />
        <ChartTooltip content={<ChartTooltipContent formatter={formatter} />} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${id})`}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export interface HBarRow {
  key: string;
  label: React.ReactNode;
  value: number;
  max: number;
  color?: string;
  hint?: React.ReactNode;
  trailing?: React.ReactNode;
}

/** Horizontal bar list for funnels and leaderboards — server-safe (no SVG). */
function HBarList({ rows, className }: { rows: HBarRow[]; className?: string }) {
  return (
    <ul className={cn('space-y-3', className)}>
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-bold">{r.label}</span>
            <span className="shrink-0 font-display font-extrabold">{r.trailing ?? r.value}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round((r.value / Math.max(1, r.max)) * 100)}%`,
                background: r.color ?? 'var(--color-ink)',
              }}
            />
          </div>
          {r.hint ? <p className="mt-1 text-[11px] text-muted">{r.hint}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartBar, ChartArea, HBarList };
