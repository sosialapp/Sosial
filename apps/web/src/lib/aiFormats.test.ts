import { describe, expect, it } from 'vitest';
import { AI_FORMATS, detectFormat } from './aiFormats';

describe('detectFormat', () => {
  it('detects the bitcoin DCA retrospective as a breakdown', () => {
    expect(
      detectFormat(
        'Write a content of how much I will made if I invest $100 every month into Bitcoin from January 2010 - January 2026',
      ),
    ).toBe('breakdown');
  });

  it('detects what-if investment topics as breakdowns', () => {
    expect(detectFormat('What if you invested $10 a day in Apple since 2005')).toBe('breakdown');
  });

  it('prefers breakdown over how-to when dates and cadence are present', () => {
    expect(detectFormat('How to invest $100 every month since 2010')).toBe('breakdown');
  });

  it('detects plain how-to topics', () => {
    expect(detectFormat('How to grow on TikTok from zero, step by step')).toBe('howto');
    expect(detectFormat('5 tips for better hooks')).toBe('howto');
  });

  it('detects personal stories', () => {
    expect(detectFormat('How I went from 0 to 10k followers in a year')).toBe('story');
    expect(detectFormat('My journey learning Spanish: mistakes I made')).toBe('story');
  });

  it('stays quiet on short or unmatched topics', () => {
    expect(detectFormat('hello')).toBeNull();
    expect(detectFormat('My morning routine')).toBeNull();
    expect(detectFormat('')).toBeNull();
  });

  it('ships exactly the three launch presets with usable instructions', () => {
    expect(AI_FORMATS.map((f) => f.id)).toEqual(['breakdown', 'howto', 'story']);
    for (const f of AI_FORMATS) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.blurb.length).toBeGreaterThan(0);
      expect(f.instructions.length).toBeGreaterThan(80);
    }
  });
});
