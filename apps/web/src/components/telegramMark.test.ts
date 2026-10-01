import { describe, expect, it } from 'vitest';
import { planeFromBundledMark } from './telegramMark';

describe('planeFromBundledMark', () => {
  it('rebases the plane subpath to absolute without touching its curves', () => {
    // Circle start (11.944, 0) + relative m4.962 7.224 == M16.906 7.224.
    const full =
      'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12' +
      'A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c1 2 3z';
    expect(planeFromBundledMark(full)).toBe('M16.906 7.224c1 2 3z');
  });

  it('falls back to the full mark when the shape is unfamiliar', () => {
    expect(planeFromBundledMark('M0 0h24v24H0z')).toBe('M0 0h24v24H0z');
  });
});
