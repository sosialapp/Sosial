import { describe, expect, it } from 'vitest';
import {
  POST_STATUS_META,
  PROVIDER_META,
  TARGET_STATUS_META,
  providerMeta,
  ttPrivacyOptionsFor,
} from './providers';

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

describe('ttPrivacyOptionsFor', () => {
  it('intersects the stored options of every picked TikTok account', () => {
    expect(
      ttPrivacyOptionsFor([
        { provider: 'tiktok', metadata: { ttPrivacyOptions: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'] } },
        {
          provider: 'tiktok',
          metadata: { ttPrivacyOptions: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'] },
        },
      ]),
    ).toEqual(['PUBLIC_TO_EVERYONE', 'SELF_ONLY']);
  });

  it('falls back to the standard set when a channel has no stored menu', () => {
    expect(ttPrivacyOptionsFor([{ provider: 'tiktok', metadata: {} }]).sort()).toEqual(
      ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'].sort(),
    );
  });

  it('returns nothing for empty menus or no TikTok channels', () => {
    expect(ttPrivacyOptionsFor([{ provider: 'tiktok', metadata: { ttPrivacyOptions: [] } }]).length).toBe(4);
    expect(ttPrivacyOptionsFor([{ provider: 'x', metadata: {} }])).toEqual([]);
    expect(ttPrivacyOptionsFor([])).toEqual([]);
  });
});
