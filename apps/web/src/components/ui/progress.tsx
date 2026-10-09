'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui Progress mapped onto the brand tokens (bolt-yellow fill on the
 * line colour track). Uncontrolled by default; pass `value` 0–100 to drive it.
 */
const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: number; indicatorClassName?: string }
>(({ className, value, indicatorClassName, ...props }, ref) => {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-line-soft', className)}
      {...props}
    >
      <div
        className={cn('h-full bg-bolt transition-[width] duration-500 ease-out', indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
});
Progress.displayName = 'Progress';

export { Progress };
