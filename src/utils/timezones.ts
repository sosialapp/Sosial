/**
 * Timezone helpers for the scheduler (mirrors the web DateTimePicker math).
 * Everything is defensive: Hermes/older engines may lack
 * `supportedValuesOf` or full ICU — every helper falls back to device-zone
 * behavior instead of throwing.
 */

const FALLBACK_ZONES = [
  'UTC',
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Sao_Paulo', 'Atlantic/Azores', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Europe/Istanbul', 'Europe/Moscow', 'Africa/Lagos',
  'Africa/Cairo', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Karachi',
  'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Singapore',
  'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Perth', 'Australia/Sydney', 'Pacific/Auckland',
];

export function deviceZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' && tz ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

export function supportedZones(): string[] {
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

/** "America/New_York" → "New York". */
export function zoneLabel(tz: string): string {
  const city = tz.split('/').pop() ?? tz;
  return city.replace(/_/g, ' ');
}

/** Offset (ms) of `tz` at the given UTC instant. */
export function tzOffsetMs(utcMs: number, tz: string): number {
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

/** "GMT+8", "GMT-5", "GMT+5:30". */
export function offsetLabel(tz: string, at = Date.now()): string {
  const off = tzOffsetMs(at, tz);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  const h = Math.floor(abs / 3_600_000);
  const mm = Math.round((abs % 3_600_000) / 60_000);
  return `GMT${sign}${h}${mm ? `:${String(mm).padStart(2, '0')}` : ''}`;
}

/**
 * UTC ms for wall time (y, m 1-12, d, minutes) in tz. The schedule picker
 * value is a wall reading in the selected zone — same re-anchor rule as web.
 */
export function zonedToUtcMs(y: number, m: number, d: number, minutes: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  return guess - tzOffsetMs(guess, tz);
}

/** "9:05 AM" for an instant rendered in tz. */
export function formatTimeInTz(ms: number, tz: string): string {
  try {
    const s = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(ms));
    return s;
  } catch {
    const d = new Date(ms);
    const h24 = d.getHours();
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(d.getMinutes()).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
  }
}
