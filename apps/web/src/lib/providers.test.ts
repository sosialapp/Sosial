import { describe, expect, it } from 'vitest';
import { POST_STATUS_META, PROVIDER_META, TARGET_STATUS_META, providerMeta } from './providers';

describe('providerMeta', () => {
  it('returns chrome for known providers', () => {
    expect(providerMeta('instagram').label).toBe('Instagram');
    expect(providerMeta('instagram').color).toBe('#E1306C');
  });

  it('falls back gracefully for unknown providers', () => {
    const meta = providerMeta('mystery');
    expect(meta.label).toBe('mystery');
    expect(meta.glyph).toBe('MY');
    expect(meta.color).toBe('#78716C');
  });
});

describe('status maps', () => {
  it('label every post status the schema allows', () => {
    const expected = ['draft', 'approval', 'queued', 'publishing', 'sent', 'partial', 'failed'];
    expect(Object.keys(POST_STATUS_META).sort()).toEqual([...expected].sort());
  });

  it('label every target status the schema allows', () => {
    const expected = ['pending', 'needs_approval', 'queued', 'publishing', 'sent', 'failed', 'skipped'];
    expect(Object.keys(TARGET_STATUS_META).sort()).toEqual([...expected].sort());
  });

  it('gives every provider a distinct label', () => {
    const labels = Object.values(PROVIDER_META).map((m) => m.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
