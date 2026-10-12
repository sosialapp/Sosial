import { describe, it, expect } from 'vitest';
import { isChainPlatform, chainLimit, joinThread, splitThread, THREAD_CAPS } from './thread';

describe('isChainPlatform', () => {
  it('recognises the four chain-capable channels', () => {
    expect(isChainPlatform('x')).toBe(true);
    expect(isChainPlatform('bluesky')).toBe(true);
    expect(isChainPlatform('mastodon')).toBe(true);
    expect(isChainPlatform('threads')).toBe(true);
  });
  it('rejects everything else', () => {
    expect(isChainPlatform('instagram')).toBe(false);
    expect(isChainPlatform('tiktok')).toBe(false);
    expect(isChainPlatform('')).toBe(false);
  });
});

describe('chainLimit', () => {
  it('picks the strictest cap across selected chain channels', () => {
    // x 280 is stricter than bluesky 300 / mastodon 500 / threads 500
    expect(chainLimit(['x', 'bluesky', 'mastodon', 'threads'])).toBe(THREAD_CAPS.x);
    expect(chainLimit(['mastodon', 'threads'])).toBe(500);
  });
  it('returns null when no chain channel is selected', () => {
    expect(chainLimit(['instagram', 'tiktok'])).toBeNull();
    expect(chainLimit([])).toBeNull();
  });
  it('tolerates a null/undefined platforms argument', () => {
    expect(chainLimit(null as unknown as string[])).toBeNull();
  });
});

describe('joinThread', () => {
  it('joins trimmed non-empty segments with blank lines', () => {
    expect(joinThread(['one', ' two ', '', 'three'])).toBe('one\n\ntwo\n\nthree');
  });
  it('returns empty string for empty input', () => {
    expect(joinThread([])).toBe('');
    expect(joinThread(['', '  '])).toBe('');
  });
});

describe('splitThread', () => {
  it('returns a single segment when text fits', () => {
    expect(splitThread('short post', 280)).toEqual(['short post']);
  });
  it('returns [] for empty input', () => {
    expect(splitThread('', 280)).toEqual([]);
    expect(splitThread('   ', 280)).toEqual([]);
  });
  it('breaks on paragraph boundaries first', () => {
    const para1 = 'a'.repeat(100);
    const para2 = 'b'.repeat(100);
    const out = splitThread(`${para1}\n\n${para2}`, 120);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(para1);
    expect(out[1]).toBe(para2);
  });
  it('never exceeds the limit', () => {
    const text = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
    const out = splitThread(text, 60);
    expect(out.length).toBeGreaterThan(1);
    for (const seg of out) expect(seg.length).toBeLessThanOrEqual(60);
  });
  it('round-trips with joinThread (all content preserved)', () => {
    const text = Array.from({ length: 60 }, (_, i) => `chunk${i} text here.`).join(' ');
    const out = splitThread(text, 80);
    expect(joinThread(out).replace(/\n\n/g, ' ')).toBe(text.replace(/\s+/g, ' ').trim());
  });
  it('hard-cuts a single unbreakable run', () => {
    const run = 'x'.repeat(150);
    const out = splitThread(run, 50);
    expect(out.join('').length).toBe(150);
    for (const seg of out) expect(seg.length).toBeLessThanOrEqual(50);
  });
});
