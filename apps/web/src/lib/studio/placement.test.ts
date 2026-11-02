import { describe, expect, it } from 'vitest';
import { blankPage, layerPlace, newBlock, patchPlace, placeCss, placeOf, RESET_PLACE, socialIconColors } from './model';

describe('canvas placement', () => {
  it('renders nothing for an unplaced element', () => {
    expect(placeCss(undefined, 2)).toBeUndefined();
    expect(placeCss({}, 2)).toEqual({});
  });

  it('scales the offset by the canvas unit and adds rotation, opacity and layer', () => {
    expect(placeCss({ dx: 10, dy: -5, rotate: 15, opacity: 0.5, z: 2 }, 2)).toEqual({
      transform: 'translate(20px, -10px) rotate(15deg)',
      opacity: 0.5,
      position: 'relative',
      zIndex: 2,
    });
  });

  it('patches and resets the title, profile row and blocks', () => {
    const b = newBlock('bullets');
    let pg = { ...blankPage(), blocks: [b] };
    pg = patchPlace(pg, { kind: 'title' }, { dx: 4, rotate: 10 });
    pg = patchPlace(pg, { kind: 'pfp' }, { dy: 8 });
    pg = patchPlace(pg, { kind: 'block', id: b.id }, { dx: -3, opacity: 0.4 });
    expect(placeOf(pg, { kind: 'title' })).toMatchObject({ dx: 4, rotate: 10 });
    expect(placeOf(pg, { kind: 'pfp' })).toMatchObject({ dy: 8 });
    expect(placeOf(pg, { kind: 'block', id: b.id })).toMatchObject({ dx: -3, opacity: 0.4 });
    pg = patchPlace(pg, { kind: 'block', id: b.id }, RESET_PLACE);
    const reset = placeOf(pg, { kind: 'block', id: b.id });
    expect(reset.dx).toBeUndefined();
    expect(reset.opacity).toBe(0.4);
  });

  it('layers blocks above or below every sibling', () => {
    const a = newBlock('bullets');
    const c = newBlock('free');
    let pg = { ...blankPage(), blocks: [a, c] };
    pg = layerPlace(pg, { kind: 'block', id: a.id }, 'front');
    expect(placeOf(pg, { kind: 'block', id: a.id }).z).toBe(1);
    pg = layerPlace(pg, { kind: 'block', id: c.id }, 'front');
    expect(placeOf(pg, { kind: 'block', id: c.id }).z).toBe(2);
    pg = layerPlace(pg, { kind: 'title' }, 'back');
    expect(placeOf(pg, { kind: 'title' }).z).toBe(-1);
  });

  it('paints social icons in brand, black or white', () => {
    expect(socialIconColors(undefined, false, '#E1306C', false, '#fff')).toEqual({ disc: '#E1306C', glyph: '#FFFFFF', border: 'transparent' });
    expect(socialIconColors('black', true, '#E1306C', false, '#fff')).toEqual({ disc: 'transparent', glyph: '#111111', border: '#111111' });
    expect(socialIconColors('white', true, '#E1306C', false, '#111')).toEqual({ disc: 'transparent', glyph: '#FFFFFF', border: '#FFFFFF' });
    expect(socialIconColors('white', false, '#E1306C', false, '#111')).toEqual({ disc: '#FFFFFF', glyph: '#E1306C', border: 'transparent' });
  });
});
