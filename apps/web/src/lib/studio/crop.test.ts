import { describe, expect, it } from 'vitest';
import { coverWindow, cropLayout, cropToRect, rectToCrop } from './crop';

/** Visible part of the photo (fractions) for a layout inside a W×H frame. */
function visible(l: { width: number; height: number; left: number; top: number }, W: number, H: number) {
  return { u: -l.left / l.width, v: -l.top / l.height, uw: W / l.width, vh: H / l.height };
}

describe('image crop v2', () => {
  it('the full cover fit is zoom 1, centred', () => {
    const { cw, ch } = coverWindow(2, 1);
    const c = rectToCrop({ u: (1 - cw) / 2, v: 0, uw: cw, vh: ch }, 2, 1);
    expect(c).toMatchObject({ zoom: 1, x: 0, v: 2 });
  });

  it('the renderer shows exactly the rect the editor picked', () => {
    // wide photo in a square frame, zoomed rect off to the right
    const rect = { u: 0.4, v: 0.2, uw: 0.25, vh: 0.5 };
    const c = rectToCrop(rect, 2, 1);
    const shown = visible(cropLayout({ ...c, ar: 2 }, 300, 300), 300, 300);
    expect(shown.u).toBeCloseTo(rect.u, 2);
    expect(shown.v).toBeCloseTo(rect.v, 2);
    expect(shown.uw).toBeCloseTo(rect.uw, 2);
    expect(shown.vh).toBeCloseTo(rect.vh, 2);
  });

  it('round-trips through the editor rect', () => {
    // the editor's rect always has the frame's shape: uw·ar / vh = frame aspect
    const rect = { u: 0.1, v: 0.3, uw: 0.4, vh: (0.4 * 0.75) / 1.125 };
    const back = cropToRect(rectToCrop(rect, 0.75, 1.125), 0.75, 1.125);
    expect(back.u).toBeCloseTo(rect.u, 2);
    expect(back.v).toBeCloseTo(rect.v, 2);
    expect(back.uw).toBeCloseTo(rect.uw, 2);
    expect(back.vh).toBeCloseTo(rect.vh, 2);
  });

  it('never leaves a gap or stretches when the frame changes shape', () => {
    const c = { zoom: 1.8, x: 1, y: -1, ar: 1.5, v: 2 as const };
    for (const [W, H] of [[300, 300], [300, 120], [120, 300]]) {
      const l = cropLayout(c, W, H);
      expect(l.width / l.height).toBeCloseTo(1.5, 5);
      expect(l.left).toBeLessThanOrEqual(0);
      expect(l.top).toBeLessThanOrEqual(0);
      expect(l.left + l.width).toBeGreaterThanOrEqual(W - 1e-6);
      expect(l.top + l.height).toBeGreaterThanOrEqual(H - 1e-6);
    }
  });
});
