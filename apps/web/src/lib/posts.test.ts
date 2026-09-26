import { describe, expect, it } from 'vitest';
import { CHAIN_PROVIDERS, threadSegments } from './posts';

describe('chain threads (worker parity)', () => {
  it('covers exactly the reply-capable providers', () => {
    expect([...CHAIN_PROVIDERS].sort()).toEqual(['bluesky', 'mastodon', 'threads', 'x']);
    for (const p of ['instagram', 'tiktok', 'youtube', 'facebook', 'pinterest', 'linkedin']) {
      expect(CHAIN_PROVIDERS).not.toContain(p);
    }
  });

  it('trims segments and drops empties for options.thread', () => {
    expect(threadSegments(['  hello  ', '', '   ', 'world'])).toEqual(['hello', 'world']);
    expect(threadSegments([])).toEqual([]);
  });
});
