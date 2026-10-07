import { describe, expect, it } from 'vitest';
import { ok, fail } from './respond';

describe('mcp response envelopes', () => {
  it('success envelope carries success:true plus data', () => {
    expect(ok({ post_id: 'p1', status: 'draft' })).toEqual({
      success: true,
      post_id: 'p1',
      status: 'draft',
    });
  });

  it('failure envelope uses stable error codes and no stack traces', () => {
    const r = fail('validation_failed', 'scheduled_at is in the past.');
    expect(r).toEqual({
      success: false,
      error_code: 'validation_failed',
      message: 'scheduled_at is in the past.',
    });
    expect(JSON.stringify(r)).not.toMatch(/stack|at\s+\w+\s+\(/i);
  });

  it('confirmation_required carries token + summary + expiry', () => {
    const r = fail('confirmation_required', 'Confirmation required.', {
      confirmation_token: 'tok',
      summary: 'Delete 1 post',
      expires_in: 300,
    });
    expect(r.confirmation_token).toBe('tok');
    expect(r.expires_in).toBe(300);
  });
});
