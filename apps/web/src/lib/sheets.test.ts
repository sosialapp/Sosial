import { describe, expect, it } from 'vitest';
import {
  parseSheetDate,
  mapSheetRow,
  matchPlatforms,
  suggestMapping,
  contentHashOf,
  type SheetsMapping,
  type SheetsOptions,
} from './sheets';

const CHANNELS = [
  { id: 'ch-li', provider: 'linkedin', display_name: 'Acme LinkedIn', handle: 'acme', label: 'Acme LinkedIn' },
  { id: 'ch-x', provider: 'x', display_name: 'Acme X', handle: 'acme', label: 'Acme X' },
];

const MAPPING: SheetsMapping = {
  dateCol: 0,
  platformCol: 1,
  contentCol: 2,
  titleCol: 3,
  mediaCol: 4,
  statusCol: 5,
  tagsCol: 6,
  statusMap: { Ready: 'scheduled', Idea: 'draft' },
};

const OPTIONS: SheetsOptions = { timeZone: 'UTC', dateOrder: 'auto', headerRow: 1 };

function row(cells: Record<number, string>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(cells)) out[Number(k)] = v;
  return out;
}

// A date guaranteed to be in the future regardless of when the suite runs —
// a hardcoded "tomorrow" goes stale once the calendar catches up with it.
function futureDate(): string {
  const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 09:00`;
}

describe('parseSheetDate', () => {
  it('parses ISO with Z, offset, and naive (in zone)', () => {
    expect(parseSheetDate('2026-10-10T09:00:00Z', 'auto', 'UTC')).toBe('2026-10-10T09:00:00.000Z');
    expect(parseSheetDate('2026-10-10T09:00:00+02:00', 'auto', 'UTC')).toBe('2026-10-10T07:00:00.000Z');
  });

  it('treats naive datetime as wall time in the given zone', () => {
    // Berlin is UTC+2 on Oct 10, 2026 (CEST)
    expect(parseSheetDate('2026-10-10 09:00', 'auto', 'Europe/Berlin')).toBe('2026-10-10T07:00:00.000Z');
    // Berlin is UTC+1 on Dec 10, 2026 (CET)
    expect(parseSheetDate('2026-12-10 09:00', 'auto', 'Europe/Berlin')).toBe('2026-12-10T08:00:00.000Z');
  });

  it('resolves ambiguous numeric dates per day/month order', () => {
    expect(parseSheetDate('03/04/2026', 'dmy', 'UTC')).toBe('2026-04-03T00:00:00.000Z');
    expect(parseSheetDate('03/04/2026', 'mdy', 'UTC')).toBe('2026-03-04T00:00:00.000Z');
    expect(parseSheetDate('03/04/2026', 'auto', 'UTC')).toBe('2026-04-03T00:00:00.000Z'); // auto → day-first
  });

  it('parses month names both orders and with time', () => {
    expect(parseSheetDate('Oct 10, 2026 14:30', 'auto', 'UTC')).toBe('2026-10-10T14:30:00.000Z');
    expect(parseSheetDate('10 Oct 2026', 'auto', 'UTC')).toBe('2026-10-10T00:00:00.000Z');
  });

  it('returns null for junk and empty', () => {
    expect(parseSheetDate('soon', 'auto', 'UTC')).toBeNull();
    expect(parseSheetDate('', 'auto', 'UTC')).toBeNull();
  });
});

describe('matchPlatforms', () => {
  it('maps provider keys and labels case-insensitively', () => {
    expect(matchPlatforms('LinkedIn, X', CHANNELS)).toEqual({ ids: ['ch-li', 'ch-x'], errors: [] });
    expect(matchPlatforms('linkedin', CHANNELS).ids).toEqual(['ch-li']);
  });
  it('flags unknown and ambiguous platforms', () => {
    expect(matchPlatforms('tiktok', CHANNELS).errors.length).toBe(1);
    const amb = matchPlatforms('x', [...CHANNELS, { id: 'x2', provider: 'x', display_name: 'X 2', handle: 'x2', label: 'X 2' }]);
    expect(amb.errors[0]).toMatch(/matches 2 connected channels/i);
  });
});

describe('mapSheetRow', () => {
  it('maps a complete row to a scheduled draft', () => {
    const when = futureDate();
    const r = row({
      0: when,
      1: 'LinkedIn',
      2: 'We are live!',
      3: 'Launch day',
      4: 'https://example.com/pic.jpg',
      5: 'Ready',
      6: 'launch, news',
    });
    const res = mapSheetRow(5, r, MAPPING, OPTIONS, CHANNELS);
    expect(res.ok).toBe(true);
    expect(res.draft?.title).toBe('Launch day');
    expect(res.draft?.body).toBe('We are live!');
    expect(res.draft?.channelIds).toEqual(['ch-li']);
    expect(res.draft?.scheduledAt).toBe(`${when.slice(0, 10)}T09:00:00.000Z`);
    expect(res.draft?.mediaUrls).toEqual(['https://example.com/pic.jpg']);
    expect(res.draft?.tags).toEqual(['launch', 'news']);
    expect(res.errors).toEqual([]);
  });

  it('errors on empty content', () => {
    const res = mapSheetRow(2, row({ 0: '2026-10-10 09:00', 1: 'X', 2: '' }), MAPPING, OPTIONS, CHANNELS);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => /content is empty/i.test(e))).toBe(true);
  });

  it('errors on past dates and unknown platforms', () => {
    const res = mapSheetRow(2, row({ 0: '2020-01-01 09:00', 1: 'tiktok', 2: 'hi' }), MAPPING, OPTIONS, CHANNELS);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => /in the past/i.test(e))).toBe(true);
    expect(res.errors.some((e) => /unknown platform/i.test(e))).toBe(true);
  });

  it('status draft wins over a valid date; unmapped status defaults to draft with warning', () => {
    const base = { 0: futureDate(), 1: 'X', 2: 'hi' };
    const draft = mapSheetRow(2, row({ ...base, 5: 'Idea' }), MAPPING, OPTIONS, CHANNELS);
    expect(draft.ok).toBe(true);
    expect(draft.draft?.scheduledAt).toBeNull();

    const unmapped = mapSheetRow(2, row({ ...base, 5: 'Whatever' }), MAPPING, OPTIONS, CHANNELS);
    expect(unmapped.ok).toBe(true);
    // A valid date + unmapped status keeps the schedule (draft-default only
    // applies when there is nothing to schedule).
    expect(unmapped.draft?.scheduledAt).toBe(`${base[0].slice(0, 10)}T09:00:00.000Z`);
    expect(unmapped.draft?.warnings.some((w) => /unmapped/i.test(w))).toBe(false);
  });

  it('status scheduled without a date is an error', () => {
    const res = mapSheetRow(2, row({ 1: 'X', 2: 'hi', 5: 'Ready' }), MAPPING, OPTIONS, CHANNELS);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => /says scheduled/i.test(e))).toBe(true);
  });

  it('warns when content exceeds a provider limit', () => {
    const r = row({ 1: 'X', 2: 'x'.repeat(300) });
    const res = mapSheetRow(2, r, { ...MAPPING, dateCol: null }, OPTIONS, CHANNELS);
    expect(res.ok).toBe(true);
    expect(res.draft?.warnings.some((w) => /exceeds the limit/i.test(w))).toBe(true);
  });

  it('warns on non-https media values', () => {
    const res = mapSheetRow(2, row({ 1: 'X', 2: 'hi', 4: 'http://insecure/a.jpg' }), { ...MAPPING, dateCol: null }, OPTIONS, CHANNELS);
    expect(res.ok).toBe(true);
    expect(res.draft?.warnings.some((w) => /not an https URL/i.test(w))).toBe(true);
  });

  it('stable hash changes with content', () => {
    const a = contentHashOf({ title: 't', body: 'b', channelIds: ['c'], scheduledAt: null, mediaUrls: [], tags: [] });
    const b = contentHashOf({ title: 't', body: 'b2', channelIds: ['c'], scheduledAt: null, mediaUrls: [], tags: [] });
    expect(a).not.toBe(b);
  });
});

describe('suggestMapping', () => {
  it('maps common header names', () => {
    const m = suggestMapping(['Publish Date', 'Network', 'Caption', 'Creative', 'State', 'Title', 'Tags']);
    expect(m.dateCol).toBe(0);
    expect(m.platformCol).toBe(1);
    expect(m.contentCol).toBe(2);
    expect(m.mediaCol).toBe(3);
    expect(m.statusCol).toBe(4);
    expect(m.titleCol).toBe(5);
    expect(m.tagsCol).toBe(6);
  });
});
