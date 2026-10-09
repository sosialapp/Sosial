'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Lightweight hover/focus tooltip on brand tokens. Renders inline (no portal)
 * so it stays inside the dashboard's `.theme-dark` scope. CSS-only — shows on
 * hover and keyboard focus, hides on Escape.
 */
export function Tooltip({
  content,
  children,
  className,
  side = 'top',
  align = 'center',
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  side?: 'top' | 'bottom';
  align?: 'start' | 'center' | 'end';
}) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <span
      className={cn('group/tt relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 w-max max-w-56 rounded-xl border border-white/10 bg-nightcard px-3 py-2 text-[11px] font-medium leading-snug text-[#F5F1E4] shadow-[0_12px_36px_rgba(0,0,0,0.35)] transition-opacity duration-150',
          align === 'center' && 'left-1/2 -translate-x-1/2',
          align === 'start' && 'left-0',
          align === 'end' && 'right-0',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          open ? 'opacity-100' : 'opacity-0',
        )}
      >
        {content}
      </span>
    </span>
  );
}
