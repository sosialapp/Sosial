'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDismiss } from '@/lib/useDismiss';

/**
 * Schedule controls in one row: date (calendar popover) · time (custom
 * stepper popover) · timezone (searchable dropdown, defaults to the user's
 * zone). Emits the correct UTC instant for the chosen wall time in the
 * chosen zone — browser offset math, no extra deps.
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

const offCache = new Map<string, string>();
function offsetLabel(tz: string): string {
  const hit = offCache.get(tz);
  if (hit) return hit;
  const off = tzOffsetMs(Date.now(), tz);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  const h = Math.floor(abs / 3_600_000);
  const mm = Math.round((abs % 3_600_000) / 60_000);
  const label = `GMT${sign}${h}${mm ? `:${String(mm).padStart(2, '0')}` : ''}`;
  offCache.set(tz, label);
  return label;
}

function zoneLabel(tz: string): string {
  const city = tz.split('/').pop() ?? tz;
  return city.replace(/_/g, ' ');
}

const fmtDay = (w: Wall): string => {
  const d = new Date(w.y, w.m - 1, w.d);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

/** Friendly 12-hour label, e.g. 9:05 AM. */
const fmtTime = (minutes: number): string => {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
};

const clampMinutes = (v: number) => Math.max(0, Math.min(1439, v));

const TRIGGER =
  'flex w-full min-w-0 items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-xs font-bold text-ink transition hover:border-ink/40';

/** A labelled −/+ stepper with a directly editable number. */
function Stepper({
  label,
  display,
  onDelta,
  onSet,
  onBlur,
  min,
  max,
}: {
  label: string;
  display: string;
  onDelta: (dir: 1 | -1) => void;
  onSet: (raw: string) => void;
  onBlur: () => void;
  min: number;
  max: number;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper p-2">
      <p className="px-1 text-[10px] font-extrabold uppercase tracking-wide text-faint">{label}</p>
      <div className="mt-1 flex items-center gap-1">
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={() => onDelta(-1)}
          disabled={min === max}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition hover:border-ink/30 hover:text-ink disabled:opacity-40"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <path d="M5 10h10" />
          </svg>
        </button>
        <input
          value={display}
          onChange={(e) => onSet(e.target.value)}
          onBlur={onBlur}
          inputMode="numeric"
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent text-center text-sm font-extrabold tabular-nums text-ink outline-none"
        />
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => onDelta(1)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition hover:border-ink/30 hover:text-ink"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <path d="M10 5v10M5 10h10" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** Hour/minute steppers with quick presets. */
function TimeField({
  wall,
  timezone,
  onEmit,
  onClose,
}: {
  wall: Wall;
  timezone: string;
  onEmit: (minutes: number) => void;
  onClose: () => void;
}) {
  const hh = Math.floor(wall.minutes / 60);
  const mm = wall.minutes % 60;
  const [draft, setDraft] = useState({ h: String(hh).padStart(2, '0'), m: String(mm).padStart(2, '0') });

  useEffect(() => {
    setDraft({ h: String(hh).padStart(2, '0'), m: String(mm).padStart(2, '0') });
  }, [hh, mm]);

  const setMinutes = (minutes: number) => onEmit(clampMinutes(minutes));

  const onDelta = (part: 'h' | 'm', dir: 1 | -1) => {
    if (part === 'h') setMinutes(((hh + dir + 24) % 24) * 60 + mm);
    else setMinutes(hh * 60 + (mm + dir + 60) % 60);
  };

  const onSet = (part: 'h' | 'm', raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, 2);
    setDraft((d) => ({ ...d, [part]: digits }));
    if (!digits) return;
    const n = Number(digits);
    if (part === 'h' && n <= 23) setMinutes(n * 60 + mm);
    if (part === 'm' && n <= 59) setMinutes(hh * 60 + n);
  };

  const nowMinutes = useMemo(() => utcToWall(new Date().toISOString(), timezone).minutes, [timezone]);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Stepper
        label="Hour"
        display={draft.h}
        min={0}
        max={23}
        onDelta={(d) => onDelta('h', d)}
        onSet={(v) => onSet('h', v)}
        onBlur={() => setDraft((d) => ({ ...d, h: d.h.padStart(2, '0') }))}
      />
      <Stepper
        label="Minute"
        display={draft.m}
        min={0}
        max={59}
        onDelta={(d) => onDelta('m', d)}
        onSet={(v) => onSet('m', v)}
        onBlur={() => setDraft((d) => ({ ...d, m: d.m.padStart(2, '0') }))}
      />
      <div className="col-span-2 mt-1 flex flex-wrap gap-1.5">
        {[
          { label: 'Now', minutes: nowMinutes },
          { label: '+30m', minutes: wall.minutes + 30 },
          { label: '+1h', minutes: wall.minutes + 60 },
          { label: '9:00', minutes: 540 },
          { label: '18:00', minutes: 1080 },
        ].map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setMinutes(p.minutes)}
            className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-bold text-soft transition hover:border-ink/30 hover:text-ink"
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-full bg-ink px-3 py-1 text-[11px] font-extrabold text-paper transition hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  );
}

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
  const zones = useMemo(supportedZones, []);
  const [open, setOpen] = useState<null | 'cal' | 'tz' | 'time'>(null);
  const [tzQuery, setTzQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(rootRef, open !== null, () => setOpen(null));

  const wall: Wall = useMemo(() => {
    if (value) return utcToWall(value, timezone);
    return utcToWall(new Date().toISOString(), timezone);
  }, [value, timezone]);

  const [view, setView] = useState<{ y: number; m: number }>(() => ({ y: wall.y, m: wall.m }));
  useEffect(() => {
    if (open === 'cal') setView({ y: wall.y, m: wall.m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const q = tzQuery.trim().toLowerCase();
  const tzMatches = useMemo(() => {
    const list = q
      ? zones.filter((z) => z.toLowerCase().includes(q) || zoneLabel(z).toLowerCase().includes(q))
      : zones;
    return list.slice(0, 80);
  }, [q, zones]);

  return (
    <div ref={rootRef} className="flex flex-wrap items-center gap-2">
      {/* Date — calendar only */}
      <div className="relative min-w-0 flex-1 sm:flex-none">
        <button
          type="button"
          onClick={() => setOpen((v) => (v === 'cal' ? null : 'cal'))}
          aria-haspopup="dialog"
          aria-expanded={open === 'cal'}
          aria-label="Pick date"
          className={`${TRIGGER} min-w-[9.5rem]`}
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
            <path d="M3 8.5h14M7 2.8v3M13 2.8v3" />
          </svg>
          <span className="truncate">{fmtDay(wall)}</span>
        </button>
        {open === 'cal' ? (
          <div
            role="dialog"
            aria-label="Pick date"
            className="absolute left-0 top-full z-40 mt-2 w-[17rem] rounded-2xl border border-line bg-card p-3 shadow-[0_24px_60px_-16px_rgba(25,21,18,0.45)]"
          >
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
                    onClick={() => {
                      emit({ ...wall, y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
                      setOpen(null);
                    }}
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
          </div>
        ) : null}
      </div>

      {/* Time — custom stepper popover */}
      <div className="relative min-w-0 flex-1 sm:flex-none">
        <button
          type="button"
          onClick={() => setOpen((v) => (v === 'time' ? null : 'time'))}
          aria-haspopup="dialog"
          aria-expanded={open === 'time'}
          aria-label="Pick time"
          className={`${TRIGGER} min-w-[6.5rem] sm:w-[7.5rem]`}
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="10" cy="10" r="7" />
            <path d="M10 6.2V10l2.6 1.6" />
          </svg>
          <span className="truncate tabular-nums">{fmtTime(wall.minutes)}</span>
        </button>
        {open === 'time' ? (
          <div
            role="dialog"
            aria-label="Pick time"
            className="absolute left-0 top-full z-40 mt-2 w-[15.5rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-card p-3 shadow-[0_24px_60px_-16px_rgba(25,21,18,0.45)]"
          >
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-faint">
              {fmtDay(wall)} · {fmtTime(wall.minutes)}
            </p>
            <TimeField
              key={timezone}
              wall={wall}
              timezone={timezone}
              onEmit={(minutes) => emit({ ...wall, minutes })}
              onClose={() => setOpen(null)}
            />
          </div>
        ) : null}
      </div>

      {/* Timezone — searchable dropdown, defaults to the user's zone */}
      <div className="relative min-w-0 flex-[1.5] sm:flex-none">
        <button
          type="button"
          onClick={() => setOpen((v) => (v === 'tz' ? null : 'tz'))}
          aria-haspopup="listbox"
          aria-expanded={open === 'tz'}
          aria-label="Pick timezone"
          className={`${TRIGGER} min-w-[10.5rem]`}
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
            <circle cx="10" cy="10" r="6.5" />
            <path d="M3.5 10h13M10 3.5c-1.8 1.8-2.7 4-2.7 6.5s.9 4.7 2.7 6.5c1.8-1.8 2.7-4 2.7-6.5S11.8 5.3 10 3.5Z" />
          </svg>
          <span className="truncate">{zoneLabel(timezone)}</span>
          <span className="ml-auto shrink-0 rounded-full bg-paper-dim px-1.5 py-0.5 text-[10px] font-extrabold text-muted">
            {offsetLabel(timezone)}
          </span>
        </button>
        {open === 'tz' ? (
          <div
            role="listbox"
            aria-label="Timezone"
            className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-line bg-card p-2 shadow-[0_24px_60px_-16px_rgba(25,21,18,0.45)]"
          >
            <input
              value={tzQuery}
              onChange={(e) => setTzQuery(e.target.value)}
              placeholder="Search your city or timezone…"
              aria-label="Search timezones"
              autoFocus
              className="field !py-1.5 text-xs"
            />
            <div className="no-scrollbar mt-1 max-h-56 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  const tz = deviceZone();
                  // Re-anchor the same wall time to the user's own zone.
                  onChange(zonedToUtc(wall.y, wall.m, wall.d, wall.minutes, tz).toISOString());
                  onTimezoneChange(tz);
                  setOpen(null);
                }}
                className={`flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs font-bold transition hover:bg-paper-dim ${timezone === deviceZone() ? 'bg-accent-soft text-accent-ink' : ''}`}
              >
                My timezone ({zoneLabel(deviceZone())})
              </button>
              {tzMatches.map((z) => (
                <button
                  key={z}
                  type="button"
                  role="option"
                  aria-selected={timezone === z}
                  onClick={() => {
                    // Same wall time, re-anchored to the new zone.
                    onChange(zonedToUtc(wall.y, wall.m, wall.d, wall.minutes, z).toISOString());
                    onTimezoneChange(z);
                    setOpen(null);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold transition hover:bg-paper-dim ${timezone === z ? 'bg-accent-soft text-accent-ink' : ''}`}
                >
                  <span className="flex-1 truncate">{zoneLabel(z)}</span>
                  <span className="text-[10px] font-medium text-faint">{offsetLabel(z)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
