import { describe, expect, it } from 'vitest';
import { REPLY_OPTION, replyTargetOptions, replyToOf } from './inbox';

describe('inbox reply options', () => {
  it('round-trips a reply reference through target options', () => {
    const opts = replyTargetOptions('discord', 'msg-123');
    expect(opts).toEqual({ discord: { [REPLY_OPTION]: 'msg-123' } });
    expect(replyToOf(opts.discord)).toBe('msg-123');
  });

  it('rejects missing or malformed references', () => {
    expect(replyToOf(null)).toBeNull();
    expect(replyToOf({})).toBeNull();
    expect(replyToOf({ replyTo: 42 })).toBeNull();
    expect(replyToOf({ replyTo: '' })).toBeNull();
  });
});
