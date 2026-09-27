'use client';

import { BarChart3, CalendarDays, CircleUserRound, Home, Lock, Plus } from 'lucide-react';
import { BrandIcon } from '@/components/BrandIcon';
import type { ProviderKey } from '@/lib/types';

/**
 * Mac snapshot (Tenner device-stack method): a laptop frame running a
 * faithful miniature of the Sosial dashboard — rail, greeting, stat tiles,
 * week strip and upcoming rows — plus two floating status chips. Pure CSS,
 * aria-hidden illustration; the numbers are sample data.
 */

const STATS: { label: string; value: string; tint: string; bg: string }[] = [
  { label: 'Total Posts', value: '128', tint: '#1d7fe0', bg: '#1d7fe01A' },
  { label: 'Sent this week', value: '24', tint: '#12914a', bg: '#12914a1A' },
  { label: 'Scheduled', value: '6', tint: '#7c5cf0', bg: '#7c5cf01A' },
  { label: 'Channels live', value: '4/10', tint: '#E1306C', bg: '#E1306C1A' },
];

const WEEK: { d: string; chips: string[]; today?: boolean }[] = [
  { d: 'M', chips: ['9:00'] },
  { d: 'T', chips: ['12:30'] },
  { d: 'W', chips: [] },
  { d: 'T', chips: ['9:00'], today: true },
  { d: 'F', chips: ['15:45'] },
  { d: 'S', chips: [] },
  { d: 'S', chips: [] },
];

const UPCOMING: { provider: ProviderKey; title: string; when: string }[] = [
  { provider: 'threads', title: 'Launch teaser', when: 'Today · 9:00 AM' },
  { provider: 'instagram', title: 'Roundup video', when: 'Today · 12:30 PM' },
];

const RAIL = [Home, CalendarDays, null, BarChart3, CircleUserRound];

export default function MacMockup() {
  return (
    <div className="relative mx-auto w-full max-w-xl select-none" aria-label="Sosial dashboard snapshot">
      {/* laptop frame */}
      <div className="relative rounded-[1.4rem] border-2 border-ink bg-ink p-2 shadow-[0_50px_100px_-40px_rgba(28,26,20,0.55)]">
        <span aria-hidden="true" className="absolute top-[3px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white/30" />
        <div className="overflow-hidden rounded-[1rem] bg-paper">
          {/* browser chrome */}
          <div className="flex items-center gap-2 border-b border-ink/10 bg-white px-3 py-2">
            <span className="flex gap-1.5" aria-hidden="true">
              <i className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
              <i className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
              <i className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-paper-dim px-2 py-1 text-[10px] font-semibold text-muted">
              <Lock className="h-2.5 w-2.5" aria-hidden="true" />
              sosial.app/dashboard
            </span>
            <span className="w-10" aria-hidden="true" />
          </div>
          {/* app body */}
          <div className="flex h-[340px] sm:h-[380px]">
            {/* mini rail */}
            <div className="flex w-11 flex-none flex-col items-center gap-3 border-r border-ink/10 py-3" aria-hidden="true">
              {RAIL.map((Icon, i) =>
                Icon === null ? (
                  <span key={i} className="grid h-7 w-7 place-items-center rounded-full bg-bolt">
                    <Plus className="h-4 w-4 text-ink" strokeWidth={2.5} />
                  </span>
                ) : (
                  <Icon key={i} className={`h-[18px] w-[18px] ${i === 0 ? 'text-ink' : 'text-faint'}`} strokeWidth={i === 0 ? 2.5 : 2} />
                ),
              )}
            </div>
            {/* main */}
            <div className="min-w-0 flex-1 overflow-hidden p-3 sm:p-4">
              <p className="font-display text-sm font-extrabold tracking-tight sm:text-base">
                Good afternoon, Studio
              </p>
              <p className="text-[10px] text-muted">Here&apos;s what&apos;s happening today.</p>
              <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                {STATS.map((s) => (
                  <div key={s.label} className="rounded-lg border border-ink/10 bg-white p-1.5">
                    <span
                      className="grid h-5 w-5 place-items-center rounded-md text-[10px] font-extrabold"
                      style={{ background: s.bg, color: s.tint }}
                      aria-hidden="true"
                    >
                      •
                    </span>
                    <p className="mt-1 font-display text-sm font-extrabold tabular-nums sm:text-base">{s.value}</p>
                    <p className="truncate text-[8px] font-bold text-faint">{s.label}</p>
                  </div>
                ))}
              </div>
              {/* week strip */}
              <div className="mt-2 grid grid-cols-7 gap-1">
                {WEEK.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full text-[8px] font-extrabold ${
                        d.today ? 'bg-ink text-paper' : 'text-faint'
                      }`}
                    >
                      {d.d}
                    </span>
                    {d.chips.length > 0 ? (
                      d.chips.map((c) => (
                        <span key={c} className="w-full rounded bg-ink px-0.5 py-0.5 text-center text-[7px] font-bold tabular-nums text-paper">
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="h-[13px]" aria-hidden="true" />
                    )}
                  </div>
                ))}
              </div>
              {/* upcoming */}
              <div className="mt-2 space-y-1.5">
                {UPCOMING.map((u) => (
                  <div key={u.title} className="flex items-center gap-2 rounded-lg border border-ink/10 bg-white p-1.5">
                    <BrandIcon provider={u.provider} className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-bold">{u.title}</span>
                      <span className="block text-[8px] text-faint">{u.when}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* base */}
      <div aria-hidden="true" className="mx-auto h-2 w-[86%] rounded-b-xl bg-ink/85" />
      <div aria-hidden="true" className="mx-auto h-1 w-24 rounded-b-lg bg-ink/40" />

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
