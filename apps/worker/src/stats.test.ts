import { describe, expect, it } from 'vitest';
import { isFacebookVideoId } from './stats';

describe('isFacebookVideoId', () => {
  it('treats a bare numeric id as a video and page_post ids as posts', () => {
    expect(isFacebookVideoId('1234567890123456')).toBe(true);
    expect(isFacebookVideoId(' 1234567890 ')).toBe(true);
    expect(isFacebookVideoId('112233445566_998877665544')).toBe(false);
    expect(isFacebookVideoId('')).toBe(false);
  });
});
