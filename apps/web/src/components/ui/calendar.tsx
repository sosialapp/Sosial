'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui Calendar (react-day-picker v10) on the brand tokens.
 *
 * v10 renders a real `<table>` (thead > tr > th, tbody > tr > td) — so the
 * grid is laid out with table semantics, never flex. The nav is absolutely
 * positioned across the top of the month so prev/next sit symmetrically
 * either side of the centred caption. All colours come from theme tokens, so
 * it follows `.theme-dark` like the rest of the dashboard.
 */
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('select-none p-3', className)}
      classNames={{
        months: 'relative flex flex-col',
        month: 'relative w-full space-y-3',
        nav: 'absolute inset-x-0 top-0 z-10 flex items-center justify-between',
        button_previous:
          'flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted transition hover:bg-paper hover:text-ink disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-muted',
        button_next:
          'flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted transition hover:bg-paper hover:text-ink disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-muted',
        month_caption: 'flex h-8 items-center justify-center',
        caption_label: 'text-sm font-extrabold tracking-tight text-ink',
        month_grid: 'w-full border-collapse',
        weekdays: '',
        weekday: 'w-9 pb-2 text-center text-[11px] font-bold uppercase tracking-wide text-faint',
        week: '',
        day: 'p-0 text-center align-middle',
        day_button:
          'mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-ink transition hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        range_start: 'rounded-l-full bg-accent-soft [&_button]:bg-accent [&_button]:text-ink [&_button:hover]:bg-accent',
        range_middle: 'bg-accent-soft [&_button:hover]:bg-bone',
        range_end: 'rounded-r-full bg-accent-soft [&_button]:bg-accent [&_button]:text-ink [&_button:hover]:bg-accent',
        today: '[&_button]:ring-1 [&_button]:ring-line',
        outside: 'text-faint opacity-40',
        disabled: 'text-faint opacity-40',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
