'use client';

import type { ComponentType } from 'react';
import Image from 'next/image';
import {
  BarChart3,
  CalendarDays,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock,
  Home,
  Link2,
  Plus,
} from 'lucide-react';
import { BrandIcon } from '@/components/BrandIcon';
import SendIcon from '@/components/SendIcon';
import type { ProviderKey } from '@/lib/types';

/**
 * MacBook mockup (Tenner device-stack method): a silver MacBook Pro frame —
 * aluminum lid, camera notch, hinged base with thumb scoop — running a
 * faithful miniature of the real Sosial dashboard (masthead pill, dock rail,
 * greeting, stat tiles, week calendar, analytics, upcoming). Pure CSS,
 * aria-hidden illustration; the numbers are sample data.
 */

const MUTED = '#6B675F';
const FAINT = '#9A958B';

type StatIcon = ComponentType<{ className?: string }>;

const STATS: { label: string; value: string; sub: string; tint: string; Icon: StatIcon }[] = [
  { label: 'Total Posts', value: '128', sub: '+14% vs. last 7 days', tint: '#1d7fe0', Icon: ChartColumn },
  { label: 'Sent this week', value: '24', sub: 'vs. last 7 days', tint: '#12914a', Icon: SendIcon },
  { label: 'Scheduled', value: '6', sub: 'In the queue now', tint: '#7c5cf0', Icon: Clock },
  { label: 'Channels live', value: '4/10', sub: 'Connected accounts', tint: '#E1306C', Icon: Link2 },
];

/** Sep 21–27, 2026 — Sunday the 27th is today, matching the current week. */
const WEEK: { letter: string; date: number; today?: boolean; chip?: { row: number; title: string; time: string } }[] = [
  { letter: 'M', date: 21, chip: { row: 1, title: 'Launch teaser', time: '9:00 AM' } },
  { letter: 'T', date: 22 },
  { letter: 'W', date: 23, chip: { row: 0, title: 'Roundup video', time: '12:30 PM' } },
  { letter: 'T', date: 24 },
  { letter: 'F', date: 25, chip: { row: 2, title: 'Tips thread', time: '3:45 PM' } },
  { letter: 'S', date: 26 },
  { letter: 'S', date: 27, today: true, chip: { row: 1, title: 'Weekend recap', time: '10:00 AM' } },
];

const ROWS = ['6 AM', '8 AM', '10 AM'];

const BAR_VALUES = [40, 12, 66, 30, 84, 18, 52];

const UPCOMING: { provider: ProviderKey; label: string; title: string; when: string }[] = [
  { provider: 'threads', label: 'Threads', title: 'Launch teaser', when: 'Today, 9:00 AM' },
  { provider: 'instagram', label: 'Instagram', title: 'Roundup video', when: 'Today, 12:30 PM' },
];

const RAIL: (typeof Home | null)[] = [Home, CalendarDays, null, BarChart3, CircleUserRound];

function Avatar({ provider, size = 20 }: { provider: ProviderKey; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full border border-[#E6E6E6] bg-white"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <BrandIcon provider={provider} className="h-[60%] w-[60%]" />
    </span>
  );
}

export default function MacMockup() {
  return (
    <div className="relative mx-auto w-full max-w-2xl select-none" aria-label="Sosial dashboard on a MacBook">
      {/* lid: silver aluminum */}
      <div
        className="relative rounded-t-[1.25rem] p-[10px] shadow-[0_50px_100px_-40px_rgba(28,26,20,0.55)]"
        style={{ background: 'linear-gradient(180deg,#F1F1F3 0%,#DDDEE1 60%,#CACBD0 100%)' }}
      >
        {/* display: black bezel + camera notch */}
        <div className="relative rounded-[0.6rem] bg-black px-[5px] pt-[5px] pb-[9px]">
          <span
            aria-hidden="true"
            className="absolute top-0 left-1/2 z-10 h-[13px] w-[58px] -translate-x-1/2 rounded-b-[6px] bg-black"
          >
            <span className="absolute top-[4px] left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-[#3a3a3a]" />
          </span>
          <div className="relative aspect-[16/10] overflow-hidden rounded-[4px] bg-white">
            {/* ── Sosial dashboard snapshot ─────────────────────────── */}
            <div className="flex h-full text-[#1C1A14]">
              {/* dock rail */}
              <div className="flex w-[36px] flex-none flex-col items-center gap-[10px] border-r border-[#F0F0F0] py-3" aria-hidden="true">
                {RAIL.map((Icon, i) =>
                  Icon === null ? (
                    <span key={i} className="grid h-[20px] w-[20px] place-items-center rounded-full bg-accent">
                      <Plus className="h-3 w-3 text-[#1C1A14]" strokeWidth={3} />
                    </span>
                  ) : (
                    <Icon
                      key={i}
                      className={`h-[15px] w-[15px] ${i === 0 ? 'text-[#1C1A14]' : ''}`}
                      strokeWidth={i === 0 ? 2.5 : 2}
                      style={i === 0 ? undefined : { color: FAINT }}
                    />
                  ),
                )}
              </div>

              {/* main */}
              <div className="min-w-0 flex-1 overflow-hidden p-2.5">
                {/* masthead pill */}
                <div className="flex h-[26px] min-w-0 items-center gap-1.5 overflow-hidden rounded-full border-2 border-[#1C1A14] bg-white pr-2 pl-1.5">
                  <Image src="/bolt.png" alt="" width={13} height={13} className="h-[13px] w-[13px] shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-display text-[9px] font-extrabold">Studio</span>
                  <span className="flex shrink-0 items-center" aria-hidden="true">
                    {(['threads', 'instagram', 'tiktok'] as ProviderKey[]).map((p, i) => (
                      <span key={p} className={i === 0 ? '' : '-ml-[4px]'}>
                        <span className="block rounded-full ring-1 ring-white">
                          <BrandIcon provider={p} className="h-[12px] w-[12px] rounded-full" />
                        </span>
                      </span>
                    ))}
                    <span className="ml-[2px] rounded-full bg-[#F4F4F4] px-[4px] py-[1px] text-[6px] font-extrabold" style={{ color: MUTED }}>
                      +1
                    </span>
                  </span>
                </div>

                {/* greeting */}
                <p className="mt-2 font-display text-[13px] font-extrabold tracking-tight">Good afternoon, Studio 👋</p>
                <p className="mt-[2px] text-[8px]" style={{ color: MUTED }}>
                  Here&apos;s what&apos;s happening with your content today.
                </p>

                {/* stat tiles */}
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {STATS.map((s) => (
                    <div key={s.label} className="rounded-[10px] border-2 border-[#1C1A14] bg-white p-1.5">
                      <div className="flex items-center gap-1">
                        <span
                          className="grid h-[15px] w-[15px] place-items-center rounded-[5px]"
                          style={{ background: `${s.tint}1A`, color: s.tint }}
                          aria-hidden="true"
                        >
                          <s.Icon className="h-2.5 w-2.5" />
                        </span>
                        <span className="truncate text-[6.5px] font-bold" style={{ color: MUTED }}>
                          {s.label}
                        </span>
                      </div>
                      <p className="mt-1 font-display text-[13px] leading-none font-extrabold tracking-tight">{s.value}</p>
                      <p className="mt-[3px] truncate text-[6px]" style={{ color: FAINT }}>
                        {s.sub}
                      </p>
                    </div>
                  ))}
                </div>

                {/* calendar + right rail */}
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {/* content calendar */}
                  <div className="col-span-2 rounded-[10px] border-2 border-[#1C1A14] bg-white p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display text-[8.5px] font-extrabold">Content Calendar</span>
                      <span className="text-[6.5px]" style={{ color: MUTED }}>
                        Sep 21 - Sep 27, 2026
                      </span>
                      <span className="flex-1" />
                      {[ChevronLeft, ChevronRight].map((C, i) => (
                        <span key={i} className="grid h-[14px] w-[14px] place-items-center rounded-full" style={{ color: MUTED }}>
                          <C className="h-[9px] w-[9px]" />
                        </span>
                      ))}
                    </div>
                    {/* day headers */}
                    <div className="mt-1.5 grid grid-cols-[16px_repeat(7,minmax(0,1fr))] pb-1">
                      <span />
                      {WEEK.map((d) => (
                        <div key={d.date} className="flex flex-col items-center gap-[1px]">
                          <span className="text-[5.5px] font-bold" style={{ color: FAINT }}>
                            {d.letter}
                          </span>
                          <span
                            className={`grid h-[13px] w-[13px] place-items-center rounded-full font-display text-[7px] font-extrabold ${
                              d.today ? 'bg-accent text-white' : ''
                            }`}
                          >
                            {d.date}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* hour rows */}
                    {ROWS.map((r, ri) => (
                      <div key={r} className="grid grid-cols-[16px_repeat(7,minmax(0,1fr))]">
                        <span className="pr-1 text-right text-[5.5px] font-medium" style={{ color: FAINT }}>
                          {r}
                        </span>
                        {WEEK.map((d) => {
                          const chip = d.chip && d.chip.row === ri ? d.chip : null;
                          return (
                            <div
                              key={d.date}
                              className={`h-[26px] border-t border-[#F0F0F0] p-[2px] [&:not(:first-child)]:border-l ${
                                d.today ? 'bg-[#FFC62E]/[0.06]' : ''
                              } ${ri === ROWS.length - 1 ? 'border-b border-[#F0F0F0]' : ''}`}
                            >
                              {chip ? (
                                <span className="block rounded-[3px] border border-[#E6E6E6] bg-white px-[3px] py-[2px] leading-tight">
                                  <span className="block truncate text-[5.5px] font-bold">{chip.title}</span>
                                  <span className="block text-[5px]" style={{ color: FAINT }}>
                                    {chip.time}
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* right rail */}
                  <div className="flex min-w-0 flex-col gap-2">
                    {/* analytics */}
                    <div className="rounded-[10px] border-2 border-[#1C1A14] bg-white p-2">
                      <div className="flex items-center justify-between">
                        <span className="truncate font-display text-[8.5px] font-extrabold">Analytics Overview</span>
                        <span className="text-[6px] font-bold">View all</span>
                      </div>
                      <div className="mt-1 flex gap-[3px]">
                        {['7D', '30D', '90D'].map((t, i) => (
                          <span
                            key={t}
                            className="rounded-[4px] px-[5px] py-[1.5px] text-[5.5px] font-extrabold"
                            style={
                              i === 0
                                ? { background: '#FDF3D7', color: '#1C1A14' }
                                : { background: '#F4F4F4', color: MUTED }
                            }
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex h-[34px] items-end gap-[2px]" aria-hidden="true">
                        {BAR_VALUES.map((h, i) => (
                          <span
                            key={i}
                            className={`w-full rounded-[2px] ${i === BAR_VALUES.length - 1 ? 'bg-accent' : ''}`}
                            style={{ height: `${h}%`, background: i === BAR_VALUES.length - 1 ? undefined : 'rgba(28,26,20,0.8)' }}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-[5.5px]" style={{ color: FAINT }}>
                        Posts sent per day, last 7 days.
                      </p>
                    </div>

                    {/* upcoming */}
                    <div className="rounded-[10px] border-2 border-[#1C1A14] bg-white p-2">
                      <span className="block font-display text-[8.5px] font-extrabold">Upcoming Posts</span>
                      <div className="mt-1 space-y-[5px]">
                        {UPCOMING.map((u) => (
                          <div key={u.title} className="flex items-center gap-[5px]">
                            <Avatar provider={u.provider} size={16} />
                            <span className="min-w-0">
                              <span className="block truncate text-[5.5px] font-bold" style={{ color: MUTED }}>
                                {u.label}
                              </span>
                              <span className="block truncate text-[6.5px] font-bold">{u.title}</span>
                              <span className="block text-[5.5px]" style={{ color: FAINT }}>
                                {u.when}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* screen glare */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent"
            />
          </div>
        </div>
      </div>

      {/* base: aluminum deck with thumb scoop */}
      <div
        aria-hidden="true"
        className="relative h-[13px] rounded-b-[9px] border-t border-[#A9AAAE]"
        style={{ background: 'linear-gradient(180deg,#C7C8CC 0%,#AAABAF 70%,#96979B 100%)' }}
      >
        <span className="absolute top-[3px] left-1/2 h-[5px] w-[70px] -translate-x-1/2 rounded-full bg-black/12" />
      </div>
      <div aria-hidden="true" className="mx-auto h-[3px] w-[94%] rounded-b-md bg-[#8E8F93]/50" />

      {/* floating chips */}
      <div className="animate-float absolute -top-3 -left-2 flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-[11px] font-bold shadow-lg sm:-left-6">
        <i className="h-2 w-2 rounded-full bg-bolt" aria-hidden="true" />
        4 queued
      </div>
      <div className="animate-float absolute -right-2 -bottom-4 flex items-center gap-1.5 rounded-full border-2 border-ink bg-ink px-3 py-1.5 text-[11px] font-bold text-paper shadow-lg [animation-delay:1.6s] [animation-duration:6.5s] sm:-right-6">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m3.5 8.5 3 3 6-7" stroke="#FFC62E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Published to 10 channels
      </div>
    </div>
  );
}
