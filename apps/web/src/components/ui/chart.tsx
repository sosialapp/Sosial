'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import SegmentedPills from '@/components/ui/segmented-pills';
import { niceScale } from '@/lib/analyticsMath';
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

/** Compact tick text: 1200 → 1.2k, 2500000 → 2.5M. */
const tick = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${Number((v / 1_000_000).toFixed(1))}M`;
  if (a >= 1000) return `${Number((v / 1000).toFixed(1))}k`;
  return String(Number(v.toFixed(2)));
};

/**
 * Value axis shared by the bar and line charts: starts at zero, tops out on a
 * round number (lib/analyticsMath niceScale, the same scale mobile draws) and
 * is labelled, so a bar's height reads as a real value. Whole-number series
 * never get fractional ticks.
 */
function useValueAxis(data: Datum[], dataKey: string, domainMax?: number) {
  return React.useMemo(() => {
    const values = data.map((d) => Number(d[dataKey])).filter((v) => Number.isFinite(v));
    const integer = values.every((v) => Number.isInteger(v));
    return niceScale(Math.max(domainMax ?? 0, ...values, 0), 4, integer);
  }, [data, dataKey, domainMax]);
}

function ValueAxis({ scale }: { scale: { max: number; ticks: number[] } }) {
  return (
    <YAxis
      width={36}
      domain={[0, scale.max]}
      ticks={scale.ticks}
      allowDecimals={false}
      tickLine={false}
      axisLine={false}
      tickFormatter={tick}
      tick={{ fill: 'var(--color-faint)', fontSize: 10 }}
    />
  );
}

/** Vertical bars on a shared axis, the workhorse for per-day / per-week counts. */
function ChartBar({
  data,
  dataKey,
  labelKey,
  color = 'var(--color-bolt)',
  height = 176,
  domainMax,
  formatter,
  xInterval = 0,
  className,
}: {
  data: Datum[];
  dataKey: string;
  labelKey: string;
  color?: string;
  height?: number;
  domainMax?: number;
  formatter?: (value: number | string) => string;
  xInterval?: number;
  className?: string;
}) {
  const scale = useValueAxis(data, dataKey, domainMax);
  return (
    <ChartContainer className={className} style={{ height }}>
      <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barCategoryGap="26%">
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis
          dataKey={labelKey}
          tickLine={false}
          axisLine={false}
          interval={xInterval}
          tick={{ fill: 'var(--color-faint)', fontSize: 10 }}
        />
        <ValueAxis scale={scale} />
        <ChartTooltip content={<ChartTooltipContent formatter={formatter} />} />
        {/* A tiny non-zero value stays visible; a zero day draws no bar. */}
        <Bar
          dataKey={dataKey}
          fill={color}
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
          minPointSize={(v: number | null | undefined) => (Number(v) > 0 ? 3 : 0)}
        />
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
        <YAxis hide domain={[0, 'auto']} />
        <ChartTooltip content={<ChartTooltipContent formatter={formatter} />} />
        <Area
          type="linear"
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

/** Plain line for a trend (interactions per day, follower growth). Straight
 *  segments between real data points (no smoothing between days), and a
 *  null value is a gap, never bridged. */
function ChartLine({
  data,
  dataKey,
  labelKey,
  color = 'var(--color-accent)',
  height = 176,
  domainMax,
  formatter,
  xInterval = 0,
  className,
}: {
  data: Datum[];
  dataKey: string;
  labelKey: string;
  color?: string;
  height?: number;
  domainMax?: number;
  formatter?: (value: number | string) => string;
  xInterval?: number;
  className?: string;
}) {
  const scale = useValueAxis(data, dataKey, domainMax);
  const dots = data.length <= 31;
  return (
    <ChartContainer className={className} style={{ height }}>
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-line)" />
        <XAxis
          dataKey={labelKey}
          tickLine={false}
          axisLine={false}
          interval={xInterval}
          tick={{ fill: 'var(--color-faint)', fontSize: 10 }}
        />
        <ValueAxis scale={scale} />
        <ChartTooltip cursor={{ stroke: 'var(--color-line)' }} content={<ChartTooltipContent formatter={formatter} />} />
        <Line
          type="linear"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2.5}
          connectNulls={false}
          dot={dots ? { r: 3, fill: color, strokeWidth: 0 } : false}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ChartContainer>
  );
}

export type ChartMode = 'bar' | 'line';

/** One series drawn as bars or a line on the same axis; the analytics
 *  cards switch between the two with ChartModeToggle. */
function ChartTrend({ mode, ...props }: React.ComponentProps<typeof ChartBar> & { mode: ChartMode }) {
  return mode === 'line' ? <ChartLine {...props} /> : <ChartBar {...props} />;
}

/** Line ↔ bar switch, the same control and order as the mobile app. */
function ChartModeToggle({
  value,
  onChange,
  labels,
}: {
  value: ChartMode;
  onChange: (mode: ChartMode) => void;
  labels: { type: string; bar: string; line: string };
}) {
  return (
    <SegmentedPills
      ariaLabel={labels.type}
      size="sm"
      value={value}
      onChange={onChange}
      options={[
        {
          value: 'line' as const,
          title: labels.line,
          label: (
            <>
              <LineChartIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {labels.line}
            </>
          ),
        },
        {
          value: 'bar' as const,
          title: labels.bar,
          label: (
            <>
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              {labels.bar}
            </>
          ),
        },
      ]}
    />
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

/** Horizontal bar list for funnels and leaderboards, server-safe (no SVG). */
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

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartBar,
  ChartArea,
  ChartLine,
  ChartTrend,
  ChartModeToggle,
  HBarList,
};
