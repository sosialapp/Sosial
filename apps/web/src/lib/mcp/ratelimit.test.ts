import { describe, expect, it, beforeEach } from 'vitest';
import { mcpRate } from './ratelimit';

describe('mcpRate', () => {
  beforeEach(() => {
    // buckets are module-level; distinct keyIds isolate tests
  });

  it('allows reads under the limit and blocks past it', () => {
    const r = mcpRate({}, 'test-key-read');
    let blocked = 0;
    for (let i = 0; i < 61; i++) {
      const res = r.take('get_post', 'read');
      if (!res.allowed) blocked++;
    }
    expect(blocked).toBe(1); // 60 allowed, the 61st blocked
  });

  it('caps writes tighter than reads', () => {
    const r = mcpRate({}, 'test-key-write');
    let blocked = 0;
    for (let i = 0; i < 21; i++) {
      const res = r.take('create_post', 'write');
      if (!res.allowed) blocked++;
    }
    expect(blocked).toBe(1);
    expect(r.take('get_post', 'read').allowed).toBe(true); // reads unaffected
  });

  it('reports retry seconds inside the window', () => {
    const r = mcpRate({}, 'test-key-retry');
    for (let i = 0; i < 20; i++) r.take('create_post', 'write');
    const res = r.take('create_post', 'write');
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('isolates counters per key', () => {
    const a = mcpRate({}, 'iso-a');
    const b = mcpRate({}, 'iso-b');
    for (let i = 0; i < 20; i++) a.take('create_post', 'write');
    expect(b.take('create_post', 'write').allowed).toBe(true);
    expect(a.take('create_post', 'write').allowed).toBe(false);
  });
});
