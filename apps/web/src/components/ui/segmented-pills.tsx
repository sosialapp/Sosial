'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SegmentedPillOption<T extends string | number> = {
  value: T;
  label: ReactNode;
  title?: string;
  disabled?: boolean;
  /** Overrides the default onChange for this option (e.g. seed a default time). */
  onSelect?: () => void;
};

type ThumbRect = { left: number; top: number; width: number; height: number; ready: boolean };

const VARIANTS = {
  /** Dark ink thumb — Post now/Schedule, pricing, AI card. */
  ink: { thumb: 'bg-ink shadow-sm', active: 'text-paper', idle: 'text-muted hover:text-ink' },
  /** Brand yellow thumb — composer kind, calendar-adjacent switches. */
  accent: { thumb: 'bg-accent shadow-sm', active: 'text-on-accent', idle: 'text-muted hover:text-ink' },
  /** Paper thumb on a dim track — calendar Day/Week/Month/Year/List. */
  paper: { thumb: 'bg-paper shadow-sm', active: 'text-ink', idle: 'text-muted hover:text-ink' },
} as const;

const SIZES = {
  sm: 'px-3 py-1 text-[11px]',
  md: 'px-3.5 py-1.5 text-xs',
  lg: 'px-5 py-2 text-sm',
} as const;

export type SegmentedPillsProps<T extends string | number> = {
  options: SegmentedPillOption<T>[];
  value: T;
  onChange?: (value: T) => void;
  ariaLabel: string;
  /** tablist = real tabs, group = toggle buttons. Defaults to group. */
  role?: 'tablist' | 'group';
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  className?: string;
  trackClassName?: string;
  buttonClassName?: string;
};

/**
 * Segmented pill switch with a sliding active thumb. One component backs
 * every mutually-exclusive pill group (Post now/Schedule, billing interval,
 * calendar views, AI card options, …) so switching animates the same way
 * everywhere: the thumb glides to the pressed pill via left/top/width/height.
 */
export default function SegmentedPills<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  role = 'group',
  variant = 'ink',
  size = 'md',
  className,
  trackClassName,
  buttonClassName,
}: SegmentedPillsProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const [thumb, setThumb] = useState<ThumbRect>({ left: 0, top: 0, width: 0, height: 0, ready: false });
  const v = VARIANTS[variant];

  useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      const btn = btnRefs.current.get(String(value));
      if (!track || !btn) {
        setThumb((t) => (t.ready ? { ...t, ready: false } : t));
        return;
      }
      setThumb({
        left: btn.offsetLeft,
        top: btn.offsetTop,
        width: btn.offsetWidth,
        height: btn.offsetHeight,
        ready: true,
      });
    };
    measure();
    const track = trackRef.current;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (track && ro) ro.observe(track);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [value, options]);

  return (
    <div
      ref={trackRef}
      role={role}
      aria-label={ariaLabel}
      className={cn(
        'relative flex max-w-full items-stretch gap-1 overflow-x-auto no-scrollbar rounded-full border border-line bg-paper p-1',
        trackClassName,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute rounded-full transition-[left,top,width,height] duration-200 ease-out motion-reduce:transition-none',
          v.thumb,
          thumb.ready ? 'opacity-100' : 'opacity-0',
        )}
        style={{ left: thumb.left, top: thumb.top, width: thumb.width, height: thumb.height }}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              btnRefs.current.set(String(o.value), el);
            }}
            type="button"
            title={o.title}
            disabled={o.disabled}
            onClick={() => (o.onSelect ? o.onSelect() : onChange?.(o.value))}
            {...(role === 'tablist'
              ? { role: 'tab', 'aria-selected': active }
              : { 'aria-pressed': active })}
            className={cn(
              'relative z-10 flex shrink-0 items-center justify-center gap-1.5 rounded-full font-bold whitespace-nowrap transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50',
              SIZES[size],
              active ? v.active : v.idle,
              buttonClassName,
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
