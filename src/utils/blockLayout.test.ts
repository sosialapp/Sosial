import { describe, expect, it } from 'vitest';
import { BlockGeom, clampedBlockOffset, fitOffset } from './blockLayout';

describe('canvas block clamp (mobile)', () => {
  const box = { x: 0, y: 0, w: 100, h: 100 };
  const geom = (rect: BlockGeom['rect'], extra: Partial<BlockGeom> = {}): BlockGeom => ({ rect, box, fit: 1, ...extra });

  it('keeps a block that fits entirely inside the box', () => {
    // 20 wide at x 10: can move -10 (hits left) .. 70 (hits right)
    expect(fitOffset(5, 10, 20, 0, 100)).toBe(5);
    expect(fitOffset(-50, 10, 20, 0, 100)).toBe(-10);
    expect(fitOffset(100, 10, 20, 0, 100)).toBe(70);
  });

  it('centres a block larger than the box instead of clipping an edge', () => {
    // 140 wide at x -20 is centred: only half the slack either way
    expect(fitOffset(0, -20, 140, 0, 100)).toBe(0);
    expect(fitOffset(-200, -20, 140, 0, 100)).toBe(-50);
    expect(fitOffset(200, -20, 140, 0, 100)).toBe(50);
  });

  it('moves the block by the drag and clamps it to the card body', () => {
    const g = geom({ x: 10, y: 10, w: 20, h: 20 });
    expect(clampedBlockOffset({}, { dx: 5, dy: -4 }, g, 1)).toEqual({ dx: 5, dy: -4 });
    expect(clampedBlockOffset({}, { dx: -50, dy: 50 }, g, 1)).toEqual({ dx: -10, dy: 50 });
    expect(clampedBlockOffset({}, { dx: 500, dy: 500 }, g, 1)).toEqual({ dx: 70, dy: 70 });
  });

  it('turns the AutoFit / stage scale into design units', () => {
    // unit 2 * fit 0.5 = 1 screen px per design unit
    const g = geom({ x: 14, y: 10, w: 20, h: 20 }, { fit: 0.5, at: { dx: 4 } });
    expect(clampedBlockOffset({ dx: 4 }, { dx: 10, dy: 0 }, g, 2).dx).toBe(14);
  });

  it('re-bases a rect measured before an earlier drag', () => {
    // measured at offset 10 (flow x 10 => rect 20), now starting from 30
    const g = geom({ x: 20, y: 10, w: 20, h: 20 }, { at: { dx: 10 } });
    expect(clampedBlockOffset({ dx: 30 }, { dx: 0, dy: 0 }, g, 1)).toEqual({ dx: 30, dy: undefined });
    // right edge stops at the body edge: base 10 + 70 + 20 = 100
    expect(clampedBlockOffset({ dx: 30 }, { dx: 100, dy: 0 }, g, 1).dx).toBe(70);
  });

  it('snaps tiny offsets back to the auto-flow spot', () => {
    const g = geom({ x: 10, y: 10, w: 20, h: 20 });
    expect(clampedBlockOffset({}, { dx: 2, dy: -2 }, g, 1)).toEqual({ dx: undefined, dy: undefined });
    expect(clampedBlockOffset({}, { dx: 3, dy: 4.4 }, g, 1)).toEqual({ dx: 3, dy: 4.5 });
  });

  it('pans a block taller than the card by its centre', () => {
    const g = geom({ x: 0, y: -40, w: 20, h: 180 });
    // already centred: the centre may travel to either body edge (50 px)
    expect(clampedBlockOffset({}, { dx: 0, dy: 500 }, g, 1).dy).toBe(50);
    expect(clampedBlockOffset({}, { dx: 0, dy: -500 }, g, 1).dy).toBe(-50);
  });
});
