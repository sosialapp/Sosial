'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Schedule controls in one row: date (calendar popover) · time (inline
 * text edit) · timezone (searchable dropdown, defaults to the user's zone).
 * Emits the correct UTC instant for the chosen wall time in the chosen
 * zone — browser offset math, no extra deps.
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

const hhmm = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

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
  const [calOpen, setCalOpen] = useState(false);
  const [tzOpen, setTzOpen] = useState(false);
  const [tzQuery, setTzQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const wall: Wall = useMemo(() => {
    if (value) return utcToWall(value, timezone);
    return utcToWall(new Date().toISOString(), timezone);
  }, [value, timezone]);

  const [view, setView] = useState<{ y: number; m: number }>(() => ({ y: wall.y, m: wall.m }));
  useEffect(() => {
    if (calOpen) setView({ y: wall.y, m: wall.m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calOpen]);

  useEffect(() => {
    if (!calOpen && !tzOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setCalOpen(false);
        setTzOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCalOpen(false);
        setTzOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [calOpen, tzOpen]);

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
          onClick={() => {
            setCalOpen((v) => !v);
            setTzOpen(false);
          }}
          aria-haspopup="dialog"
          aria-expanded={calOpen}
          aria-label="Pick date"
          className="flex w-full min-w-[9.5rem] items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-xs font-bold text-ink transition hover:border-ink/40"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
            <path d="M3 8.5h14M7 2.8v3M13 2.8v3" />
          </svg>
          <span className="truncate">{fmtDay(wall)}</span>
        </button>
        {calOpen ? (
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
                      setCalOpen(false);
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

      {/* Time — inline text edit */}
      <input
        type="time"
        value={hhmm(wall.minutes)}
        onChange={(e) => {
          const [h, m] = e.target.value.split(':').map(Number);
          if (Number.isFinite(h) && Number.isFinite(m)) {
            emit({ ...wall, minutes: Math.max(0, Math.min(1439, h * 60 + m)) });
          }
        }}
        aria-label="Time"
        className="field !w-auto min-w-0 flex-1 !py-2 text-xs font-bold sm:flex-none sm:w-[7.5rem]"
      />

      {/* Timezone — searchable dropdown, defaults to the user's zone */}
      <div className="relative min-w-0 flex-[1.5] sm:flex-none">
        <button
          type="button"
          onClick={() => {
            setTzOpen((v) => !v);
            setCalOpen(false);
          }}
          aria-haspopup="listbox"
          aria-expanded={tzOpen}
          aria-label="Pick timezone"
          className="flex w-full min-w-[10.5rem] items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-xs font-bold text-ink transition hover:border-ink/40"
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
        {tzOpen ? (
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
            <div className="mt-1 max-h-56 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  const tz = deviceZone();
                  // Re-anchor the same wall time to the user's own zone.
                  onChange(zonedToUtc(wall.y, wall.m, wall.d, wall.minutes, tz).toISOString());
                  onTimezoneChange(tz);
                  setTzOpen(false);
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
                    setTzOpen(false);
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
