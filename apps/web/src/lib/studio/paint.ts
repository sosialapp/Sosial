/**
 * Paint helpers shared by StudioCanvas and the block renderer: the font
 * fragment plus the hex luminance / contrast maths used by the adaptive
 * chrome. Colour maths mirrors mobile src/utils/color.ts, keep in sync.
 */
import type { CSSProperties } from 'react';
import { FONT_STACKS, type FontId } from './model';

export function ff(font: FontId | undefined, bold = false, italic = false): CSSProperties {
  return {
    fontFamily: FONT_STACKS[font ?? 'inter'],
    fontWeight: bold ? 700 : 400,
    fontStyle: italic ? 'italic' : 'normal',
  };
}

function rgb(hex: string): [number, number, number] {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = (s: string) => {
    const v = parseInt(s, 16);
    return isNaN(v) ? 255 : v;
  };
  return [n(full.slice(0, 2)) / 255, n(full.slice(2, 4)) / 255, n(full.slice(4, 6)) / 255];
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isDarkHex(hex: string): boolean {
  return luminance(hex || '#ffffff') < 0.45;
}

/** WCAG-style contrast ratio between two hex colors (1 = identical, 21 = max). */
export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
