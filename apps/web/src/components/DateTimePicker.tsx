'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, Globe, Minus, Plus } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Schedule controls in one row: date (shadcn calendar popover) · time (stepper
 * popover) · timezone (searchable dropdown, defaults to the user's zone).
 * Emits the correct UTC instant for the chosen wall time in the chosen zone —
 * browser offset math, no extra deps. Styling mirrors the analytics range
 * picker: pill triggers + themed Popover/Calendar.
 */

type Wall = { y: number; m: number; d: number; minutes: number };

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

/** Pill trigger — matches the analytics range/channel controls. */
const TRIGGER =
  'inline-flex min-w-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition';

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
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
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
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
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
          className="ml-auto rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold text-on-accent transition hover:bg-accent-bright"
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
  const [open, setOpen] = useState<null | 'cal' | 'time' | 'tz'>(null);
  const [tzQuery, setTzQuery] = useState('');

  const wall: Wall = useMemo(() => {
    if (value) return utcToWall(value, timezone);
    return utcToWall(new Date().toISOString(), timezone);
  }, [value, timezone]);

  const emit = (next: Wall) => {
    onChange(zonedToUtc(next.y, next.m, next.d, next.minutes, timezone).toISOString());
  };

  const selectedDate = useMemo(() => new Date(wall.y, wall.m - 1, wall.d), [wall.y, wall.m, wall.d]);
  // Past days can't be scheduled (mobile parity: the queue needs >= 5 min
  // lead, and the submit + write layers reject anything too soon anyway).
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const q = tzQuery.trim().toLowerCase();
  // No render cap: the full IANA list must stay scrollable (a cap used to
  // cut the list off around America/Caracas).
  const tzMatches = useMemo(() => {
    if (!q) return zones;
    return zones.filter((z) => z.toLowerCase().includes(q) || zoneLabel(z).toLowerCase().includes(q));
  }, [q, zones]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Date — shadcn calendar popover */}
      <Popover open={open === 'cal'} onOpenChange={(o) => setOpen(o ? 'cal' : null)}>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Pick date" className={`${TRIGGER} border-line bg-card text-muted hover:bg-paper`}>
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{fmtDay(wall)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            disabled={{ before: todayStart }}
            onSelect={(d) => {
              if (!d) return;
              emit({ ...wall, y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
              setOpen(null);
            }}
          />
        </PopoverContent>
      </Popover>

      {/* Time — stepper popover */}
      <Popover open={open === 'time'} onOpenChange={(o) => setOpen(o ? 'time' : null)}>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Pick time" className={`${TRIGGER} border-line bg-card text-muted hover:bg-paper`}>
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate tabular-nums">{fmtTime(wall.minutes)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[16.5rem] p-3" align="start">
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
        </PopoverContent>
      </Popover>

      {/* Timezone — searchable dropdown, defaults to the user's zone */}
      <Popover open={open === 'tz'} onOpenChange={(o) => setOpen(o ? 'tz' : null)}>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Pick timezone" className={`${TRIGGER} border-line bg-card text-muted hover:bg-paper`}>
            <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{zoneLabel(timezone)}</span>
            <span className="ml-0.5 shrink-0 rounded-full bg-paper-dim px-1.5 py-0.5 text-[10px] font-extrabold text-muted">
              {offsetLabel(timezone)}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="end">
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
        </PopoverContent>
      </Popover>
    </div>
  );
}
