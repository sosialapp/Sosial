'use client';

import * as React from 'react';
import { ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

/**
 * shadcn-style chart primitives on brand tokens. Colors resolve through the
 * app's CSS vars so charts flip with the theme automatically.
 */

function ChartContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactElement;
}) {
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
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

export { ChartContainer, ChartTooltip, ChartTooltipContent };
