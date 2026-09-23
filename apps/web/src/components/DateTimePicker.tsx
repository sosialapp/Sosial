'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Date + time + timezone picker — calendar grid, scrollable time list,
 * timezone select. Emits the correct UTC instant for the chosen wall time
 * in the chosen zone (browser offset math, no extra deps).
 */

type Wall = { y: number; m: number; d: number; minutes: number };

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const FALLBACK_ZONES = [
  'UTC',
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Istanbul', 'Europe/Moscow', 'Africa/Lagos', 'Africa/Cairo',
  'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata',
  'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Singapore', 'Asia/Hong_Kong',
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Perth',
  'Australia/Sydney', 'Pacific/Auckland',
];

function supportedZones(): string[] {
  try {
    const list = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.('timeZone');
    if (list && list.length > 0) return list;
  } catch {
    /* older engines */
  }
  return FALLBACK_ZONES;
}

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Offset (ms) of `tz` at the given UTC instant. */
function tzOffsetMs(utcMs: number, tz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = dtf.formatToParts(new Date(utcMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - utcMs;
  } catch {
    return 0;
  }
}

/** UTC instant for wall time (y, m 1-12, d, minutes) in tz. */
function zonedToUtc(y: number, m: number, d: number, minutes: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const off = tzOffsetMs(guess, tz);
  return new Date(guess - off);
}

/** Wall components of a UTC instant in tz. */
function utcToWall(iso: string, tz: string): Wall {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(iso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day'), minutes: get('hour') * 60 + get('minute') };
}

function offsetLabel(tz: string): string {
  const off = tzOffsetMs(Date.now(), tz);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  const h = Math.floor(abs / 3_600_000);
  const mm = Math.round((abs % 3_600_000) / 60_000);
  return `GMT${sign}${h}${mm ? `:${String(mm).padStart(2, '0')}` : ''}`;
}

function zoneLabel(tz: string): string {
  const city = tz.split('/').pop() ?? tz;
  return city.replace(/_/g, ' ');
}

const fmtClock = (minutes: number): string => {
  const h24 = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const ap = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
};

const fmtDay = (w: Wall): string => {
  const d = new Date(w.y, w.m - 1, w.d);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

export default function DateTimePicker({
  value,
  timezone,
  onChange,
  onTimezoneChange,
}: {
  value: string | null;
  timezone: string;
  onChange: (iso: string | null) => void;
  onTimezoneChange: (tz: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const zones = useMemo(supportedZones, []);

  const wall: Wall = useMemo(() => {
    if (value) return utcToWall(value, timezone);
    const now = utcToWall(new Date().toISOString(), timezone);
    return { ...now, minutes: Math.min(1439, Math.ceil(now.minutes / 30) * 30) };
  }, [value, timezone, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const [view, setView] = useState<{ y: number; m: number }>(() => ({ y: wall.y, m: wall.m }));
  useEffect(() => {
    if (open) setView({ y: wall.y, m: wall.m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Keep the selected time visible when the popover opens.
  useEffect(() => {
    if (!open) return;
    const el = timeRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    el?.scrollIntoView({ block: 'center' });
  }, [open]);

  const emit = (next: Wall) => {
    onChange(zonedToUtc(next.y, next.m, next.d, next.minutes, timezone).toISOString());
  };

  const monthMatrix = useMemo(() => {
    const first = new Date(view.y, view.m - 1, 1);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    const start = new Date(view.y, view.m - 1, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [view]);

  const todayKey = new Date().toDateString();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex min-w-0 items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-ink transition hover:border-ink/40"
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
          <path d="M3 8.5h14M7 2.8v3M13 2.8v3" />
        </svg>
        <span className="truncate">{fmtDay(wall)}</span>
        <span className="text-faint">·</span>
        <span className="truncate">{fmtClock(wall.minutes)}</span>
        <span className="rounded-full bg-paper-dim px-1.5 py-0.5 text-[10px] font-extrabold text-muted">
          {offsetLabel(timezone)}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Pick date, time and timezone"
          className="absolute left-0 top-full z-40 mt-2 w-[19.5rem] rounded-2xl border border-line bg-card p-3 shadow-[0_24px_60px_-16px_rgba(25,21,18,0.45)]"
        >
          {/* Calendar */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setView(({ y, m }) => (m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-paper-dim hover:text-ink"
            >
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m12.5 4.5-6 5.5 6 5.5" />
              </svg>
            </button>
            <p className="text-sm font-extrabold">{MONTHS[view.m - 1]} {view.y}</p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setView(({ y, m }) => (m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-paper-dim hover:text-ink"
            >
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m7.5 4.5 6 5.5-6 5.5" />
              </svg>
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((d) => (
              <span key={d} className="text-[10px] font-bold text-faint">{d}</span>
            ))}
            {monthMatrix.map((d) => {
              const selected = d.getFullYear() === wall.y && d.getMonth() + 1 === wall.m && d.getDate() === wall.d;
              const outside = d.getMonth() + 1 !== view.m;
              const isToday = d.toDateString() === todayKey;
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => emit({ ...wall, y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() })}
                  className={`flex h-8 items-center justify-center rounded-lg text-xs font-bold transition ${
                    selected
                      ? 'bg-ink text-paper'
                      : outside
                        ? 'text-faint hover:bg-paper-dim'
                        : isToday
                          ? 'text-accent-ink hover:bg-accent-soft'
                          : 'text-soft hover:bg-paper-dim'
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Time list */}
          <p className="mt-3 text-[10px] font-extrabold uppercase tracking-wide text-faint">Time</p>
          <div ref={timeRef} className="mt-1 h-28 overflow-y-auto rounded-xl border border-line bg-paper p-1">
            <div className="grid grid-cols-2 gap-1">
              {Array.from({ length: 48 }, (_, i) => i * 30).map((m) => (
                <button
                  key={m}
                  type="button"
                  data-selected={m === wall.minutes}
                  onClick={() => emit({ ...wall, minutes: m })}
                  className={`rounded-lg px-2 py-1.5 text-left text-xs font-bold transition ${
                    m === wall.minutes ? 'bg-ink text-paper' : 'text-soft hover:bg-paper-dim'
                  }`}
                >
                  {fmtClock(m)}
                </button>
              ))}
            </div>
          </div>

          {/* Timezone */}
          <p className="mt-3 text-[10px] font-extrabold uppercase tracking-wide text-faint">Timezone</p>
          <select
            value={timezone}
            onChange={(e) => {
              const tz = e.target.value;
              onTimezoneChange(tz);
              // Same wall time, re-anchored to the new zone.
              onChange(zonedToUtc(wall.y, wall.m, wall.d, wall.minutes, tz).toISOString());
            }}
            aria-label="Timezone"
            className="field mt-1 !py-1.5 text-xs"
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {zoneLabel(z)} ({offsetLabel(z)})
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
