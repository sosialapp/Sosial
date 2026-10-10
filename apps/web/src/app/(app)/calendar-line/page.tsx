import { redirect } from 'next/navigation';

/** Old agenda URL — the schedule now lives in the Day view. */
export default async function CalendarLinePage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  redirect(d ? `/calendar-day?d=${d}` : '/calendar-day');
}
