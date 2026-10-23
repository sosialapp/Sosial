import { describe, expect, it } from 'vitest';
import { primaryTarget } from './postTargets';
import type { PostTargetRow } from './types';

const target = (id: string, status: PostTargetRow['status']): PostTargetRow =>
  ({ id, status, channel_id: `ch_${id}`, provider: 'x' }) as PostTargetRow;

describe('primaryTarget', () => {
  it('returns null for a post with no destinations', () => {
    expect(primaryTarget({ post_targets: [] })).toBeNull();
    expect(primaryTarget({})).toBeNull();
  });

  it('prefers the destination that actually went out, not the array order', () => {
    const pick = primaryTarget({ post_targets: [target('a', 'failed'), target('b', 'sent')] });
    expect(pick?.id).toBe('b');
  });

  it('falls back to an in-flight destination for a queued post', () => {
    const pick = primaryTarget({ post_targets: [target('a', 'pending'), target('b', 'publishing')] });
    expect(pick?.id).toBe('b');
  });

  it('keeps the failed destination when nothing went out', () => {
    const pick = primaryTarget({ post_targets: [target('a', 'failed'), target('b', 'skipped')] });
    expect(pick?.id).toBe('a');
  });

  it('keeps insertion order when every destination has the same outcome', () => {
    const pick = primaryTarget({ post_targets: [target('a', 'sent'), target('b', 'sent')] });
    expect(pick?.id).toBe('a');
  });
});
