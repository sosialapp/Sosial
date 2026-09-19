import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dayKey,
  formatDate,
  formatDateTime,
  formatTime,
  fromDateTimeLocal,
  isSameDay,
  monthMatrix,
  moveToDay,
  toDateTimeLocal,
} from './format';

describe('dayKey', () => {
  it('formats local Y-M-D with zero padding', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('does not shift the day for late-evening local times', () => {
    expect(dayKey(new Date(2026, 5, 10, 23, 30))).toBe('2026-06-10');
  });
});

describe('monthMatrix', () => {
  it('returns a 6x7 grid starting on Monday', () => {
    const weeks = monthMatrix(new Date(2026, 8, 15));
    expect(weeks).toHaveLength(6);
    for (const w of weeks) expect(w).toHaveLength(7);
    for (const w of weeks) expect(w[0].getDay()).toBe(1);
  });

  it('covers every day of the month', () => {
    const weeks = monthMatrix(new Date(2026, 1, 10));
    const keys = new Set(weeks.flat().map(dayKey));
    for (let d = 1; d <= 28; d++) {
      expect(keys.has(dayKey(new Date(2026, 1, d)))).toBe(true);
    }
  });
});

describe('addMonths / addDays', () => {
  it('wraps across the year boundary', () => {
    expect(addMonths(new Date(2026, 11, 15), 1).getMonth()).toBe(0);
    expect(addMonths(new Date(2026, 0, 15), -1).getFullYear()).toBe(2025);
  });

  it('adds days across month boundaries', () => {
    expect(dayKey(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
  });
});

describe('isSameDay', () => {
  it('ignores the time of day', () => {
    expect(isSameDay(new Date(2026, 3, 2, 1), new Date(2026, 3, 2, 22))).toBe(true);
    expect(isSameDay(new Date(2026, 3, 2), new Date(2026, 3, 3))).toBe(false);
  });
});

describe('moveToDay', () => {
  it('moves the calendar day but keeps the time of day', () => {
    const src = new Date(2026, 4, 10, 14, 30).toISOString();
    const moved = new Date(moveToDay(src, new Date(2026, 4, 20)));
    expect(moved.getDate()).toBe(20);
    expect(moved.getMonth()).toBe(4);
    expect(moved.getHours()).toBe(14);
    expect(moved.getMinutes()).toBe(30);
  });

  it('falls back to now when there is no source timestamp', () => {
    const moved = new Date(moveToDay(null, new Date(2026, 4, 20)));
    expect(moved.getDate()).toBe(20);
  });
});

describe('datetime-local round trip', () => {
  it('parses back the same local wall-clock time', () => {
    const iso = fromDateTimeLocal('2026-01-05T09:30');
    expect(iso).not.toBeNull();
    const d = new Date(iso as string);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
    expect(d.getDate()).toBe(5);
  });

  it('rejects empty and malformed values', () => {
    expect(fromDateTimeLocal('')).toBeNull();
    expect(fromDateTimeLocal('not-a-date')).toBeNull();
  });

  it('emits a well-formed local value', () => {
    expect(toDateTimeLocal('2026-03-09T08:05:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe('display helpers', () => {
  it('renders placeholders for missing timestamps', () => {
    expect(formatTime(null)).toBe('');
    expect(formatDate(null)).toBe('No date');
    expect(formatDateTime(null)).toBe('No date');
  });
});
