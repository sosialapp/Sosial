import { describe, expect, it } from 'vitest';
import { isoDate, mediaKind, plainText, previewText, PREVIEW_CHARS } from './postPreview';

describe('post preview helpers', () => {
  it('flattens Mastodon HTML into one readable line', () => {
    expect(plainText('<p>Hello <strong>world</strong> &amp; friends</p><p>line two</p>')).toBe(
      'Hello world & friends\nline two',
    );
    expect(plainText('<p>a<br>b</p>')).toBe('a\nb');
    expect(plainText(null)).toBeNull();
    expect(plainText('<p> </p>')).toBeNull();
  });

  it('decodes numeric entities', () => {
    expect(plainText('<p>&#9889; &#x26A1;</p>')).toBe('\u26a1 \u26a1');
  });

  it('collapses whitespace and caps long captions', () => {
    expect(previewText('  a \n\n b  ')).toBe('a b');
    const long = previewText('x'.repeat(PREVIEW_CHARS + 50));
    expect(long).toHaveLength(PREVIEW_CHARS);
    expect(long?.endsWith('\u2026')).toBe(true);
    expect(previewText('')).toBeNull();
  });

  it('accepts seconds, milliseconds and ISO timestamps', () => {
    expect(isoDate('1729000000')).toBe('2024-10-15T13:46:40.000Z');
    expect(isoDate(1729000000000)).toBe('2024-10-15T13:46:40.000Z');
    expect(isoDate('2026-10-22T10:00:00+0000')).toBe('2026-10-22T10:00:00.000Z');
    expect(isoDate('')).toBeNull();
    expect(isoDate('not a date')).toBeNull();
  });

  it('maps every platform media vocabulary onto four buckets', () => {
    expect(mediaKind('IMAGE')).toBe('image');
    expect(mediaKind('photo')).toBe('image');
    expect(mediaKind('VIDEO')).toBe('video');
    expect(mediaKind('CAROUSEL_ALBUM')).toBe('carousel');
    expect(mediaKind('TEXT_POST')).toBe('text');
    expect(mediaKind(undefined)).toBe('text');
  });
});
