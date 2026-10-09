'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui Calendar (react-day-picker v10) on the brand tokens. Supports
 * single and range selection; used by the analytics date-range picker.
 */
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        month_caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-bold',
        nav: 'space-x-1 flex items-center',
        button_previous:
          'absolute left-1 h-7 w-7 bg-transparent p-0 rounded-full border border-line text-muted transition hover:bg-bone hover:text-ink flex items-center justify-center',
        button_next:
          'absolute right-1 h-7 w-7 bg-transparent p-0 rounded-full border border-line text-muted transition hover:bg-bone hover:text-ink flex items-center justify-center',
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday: 'text-faint rounded-md w-8 font-bold text-[0.7rem]',
        week: 'flex w-full mt-1',
        day: 'relative p-0 text-center text-xs focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent-soft first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full',
        day_button:
          'h-8 w-8 p-0 font-bold rounded-full transition hover:bg-bone aria-selected:opacity-100',
        range_start: 'rounded-l-full',
        range_end: 'rounded-r-full',
        selected:
          'bg-accent text-ink hover:bg-accent hover:text-ink focus:bg-accent focus:text-ink',
        today: 'border border-line',
        outside: 'text-faint opacity-50',
        disabled: 'text-faint opacity-40',
        range_middle: 'aria-selected:bg-accent-soft aria-selected:text-ink rounded-none',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
