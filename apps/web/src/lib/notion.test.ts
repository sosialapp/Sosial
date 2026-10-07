import { describe, expect, it } from 'vitest';
import {
  mapRowToDraft,
  parseNotionDate,
  notionPlainText,
  readProperty,
  contentHashOf,
  type NotionMapping,
  type NotionRow,
} from './notion';

const CHANNELS = [
  { id: 'ch-li', provider: 'linkedin', display_name: 'Acme LinkedIn', handle: 'acme' },
  { id: 'ch-x', provider: 'x', display_name: 'Acme X', handle: 'acme' },
];

const MAPPING: NotionMapping = {
  content: 'Brief',
  title: 'Name',
  platform: 'Network',
  platform_map: { LinkedIn: ['ch-li'], X: ['ch-x'] },
  status: 'Stage',
  status_map: { Ready: 'scheduled', Idea: 'draft' },
  date: 'When',
  media: 'Assets',
  tags: 'Tags',
};

function row(props: Record<string, any>, id = 'page-1'): NotionRow {
  return { id, lastEdited: '2026-10-07T00:00:00Z', properties: props };
}

describe('readProperty', () => {
  it('reads title, rich text, select, status, multi-select', () => {
    expect(readProperty({ type: 'title', title: [{ plain_text: 'Hello ' }, { plain_text: 'world' }] })?.text).toBe('Hello world');
    expect(readProperty({ type: 'rich_text', rich_text: [{ plain_text: 'Body' }] })?.text).toBe('Body');
    expect(readProperty({ type: 'select', select: { name: 'LinkedIn' } })?.text).toBe('LinkedIn');
    expect(readProperty({ type: 'status', status: { name: 'Ready' } })?.text).toBe('Ready');
    expect(readProperty({ type: 'multi_select', multi_select: [{ name: 'a' }, { name: 'b' }] })?.text).toBe('a, b');
  });

  it('reads date with timezone, files, checkbox; null for unsupported types', () => {
    const d = readProperty({ type: 'date', date: { start: '2026-10-10T09:00:00Z', time_zone: 'Europe/Berlin' } });
    expect(d?.date?.start).toBe('2026-10-10T09:00:00Z');
    expect(d?.date?.timeZone).toBe('Europe/Berlin');
    const f = readProperty({ type: 'files', files: [{ type: 'file', name: 'pic', file: { url: 'https://x/y.jpg' } }] });
    expect(f?.files?.[0]?.url).toBe('https://x/y.jpg');
    expect(readProperty({ type: 'checkbox', checkbox: true })?.text).toBe('true');
    expect(readProperty({ type: 'relation', relation: [] })).toBeNull();
    expect(readProperty({ type: 'rollup', rollup: {} })).toBeNull();
  });
});

describe('mapRowToDraft', () => {
  it('maps a complete row to a scheduled draft', () => {
    const r = row({
      Name: { type: 'title', title: [{ plain_text: 'Launch day' }] },
      Brief: { type: 'rich_text', rich_text: [{ plain_text: 'We are live!' }] },
      Network: { type: 'select', select: { name: 'LinkedIn' } },
      Stage: { type: 'status', status: { name: 'Ready' } },
      When: { type: 'date', date: { start: '2026-10-10T09:00:00Z' } },
      Assets: { type: 'files', files: [] },
      Tags: { type: 'multi_select', multi_select: [{ name: 'launch' }] },
    });
    const res = mapRowToDraft(r, MAPPING, null, CHANNELS);
    expect(res.ok).toBe(true);
    expect(res.draft?.title).toBe('Launch day');
    expect(res.draft?.body).toBe('We are live!');
    expect(res.draft?.channelIds).toEqual(['ch-li']);
    expect(res.draft?.scheduledAt).toBe('2026-10-10T09:00:00.000Z');
    expect(res.draft?.tags).toEqual(['launch']);
    expect(res.errors).toEqual([]);
  });

  it('errors on empty content', () => {
    const r = row({
      Name: { type: 'title', title: [] },
      Brief: { type: 'rich_text', rich_text: [] },
      Network: { type: 'select', select: { name: 'X' } },
    });
    const res = mapRowToDraft(r, MAPPING, null, CHANNELS);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => /content is empty/i.test(e))).toBe(true);
  });

  it('flags unmapped platform values instead of guessing', () => {
    const r = row({
      Brief: { type: 'rich_text', rich_text: [{ plain_text: 'hi' }] },
      Network: { type: 'select', select: { name: 'TikTok' } },
    });
    const res = mapRowToDraft(r, MAPPING, null, CHANNELS);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => /"TikTok" is not mapped/i.test(e))).toBe(true);
  });

  it('flags a mapped channel that is no longer connected', () => {
    const r = row({
      Brief: { type: 'rich_text', rich_text: [{ plain_text: 'hi' }] },
      Network: { type: 'select', select: { name: 'LinkedIn' } },
    });
    const res = mapRowToDraft(r, MAPPING, null, [CHANNELS[1]]);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => /not connected anymore/i.test(e))).toBe(true);
  });

  it('defaults unmapped status to draft and drops the date', () => {
    const r = row({
      Brief: { type: 'rich_text', rich_text: [{ plain_text: 'hi' }] },
      Network: { type: 'select', select: { name: 'X' } },
      Stage: { type: 'status', status: { name: 'Weird value' } },
      When: { type: 'date', date: { start: '2026-10-10T09:00:00Z' } },
    });
    const res = mapRowToDraft(r, MAPPING, null, CHANNELS);
    expect(res.ok).toBe(true);
    expect(res.draft?.scheduledAt).toBeNull();
    expect(res.draft?.warnings.some((w) => /unmapped/i.test(w))).toBe(true);
  });

  it('errors when scheduled status has no valid date', () => {
    const r = row({
      Brief: { type: 'rich_text', rich_text: [{ plain_text: 'hi' }] },
      Network: { type: 'select', select: { name: 'X' } },
      Stage: { type: 'status', status: { name: 'Ready' } },
      When: { type: 'date', date: { start: 'not-a-date' } },
    });
    const res = mapRowToDraft(r, MAPPING, null, CHANNELS);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => /not parseable/i.test(e) || /no valid date/i.test(e))).toBe(true);
  });

  it('uses page body when content maps to __page_body__', () => {
    const r = row({
      Name: { type: 'title', title: [{ plain_text: 'Doc' }] },
      Network: { type: 'select', select: { name: 'X' } },
    });
    const res = mapRowToDraft(r, { ...MAPPING, content: '__page_body__' }, 'Body from blocks', CHANNELS);
    expect(res.ok).toBe(true);
    expect(res.draft?.body).toBe('Body from blocks');
  });

  it('warns and skips unsupported property types that are mapped', () => {
    const r = row({
      Brief: { type: 'rich_text', rich_text: [{ plain_text: 'hi' }] },
      Network: { type: 'select', select: { name: 'X' } },
      When: { type: 'relation', relation: [{ id: 'x' }] },
    });
    const res = mapRowToDraft(r, MAPPING, null, CHANNELS);
    expect(res.ok).toBe(true);
    expect(res.draft?.warnings.some((w) => /unsupported property type/i.test(w))).toBe(true);
  });

  it('single-channel workspaces work without platform mapping', () => {
    const m: NotionMapping = { content: 'Brief' };
    const r = row({ Brief: { type: 'rich_text', rich_text: [{ plain_text: 'hi' }] } });
    const res = mapRowToDraft(r, m, null, [CHANNELS[0]]);
    expect(res.ok).toBe(true);
    expect(res.draft?.channelIds).toEqual(['ch-li']);
  });

  it('stable content hash changes when content changes', () => {
    const h1 = contentHashOf({ title: 't', body: 'b', channelIds: ['c'], scheduledAt: null, mediaUrls: [], tags: [] });
    const h2 = contentHashOf({ title: 't', body: 'b2', channelIds: ['c'], scheduledAt: null, mediaUrls: [], tags: [] });
    expect(h1).not.toBe(h2);
  });
});

describe('parseNotionDate', () => {
  it('parses ISO datetime and date-only', () => {
    expect(parseNotionDate('2026-10-10T09:00:00Z')).toBe('2026-10-10T09:00:00.000Z');
    expect(parseNotionDate('2026-10-10')).toBe('2026-10-10T00:00:00.000Z');
  });
  it('returns null for junk', () => {
    expect(parseNotionDate('soon')).toBeNull();
  });
});

describe('notionPlainText', () => {
  it('joins rich text arrays', () => {
    expect(notionPlainText([{ plain_text: 'a' }, { plain_text: 'b' }])).toBe('ab');
    expect(notionPlainText(undefined)).toBe('');
  });
});
