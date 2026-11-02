import type { ViewStyle } from 'react-native';
import { uid } from '../constants';
import { BlockStyle, ContentBlock, Placement, PostPage, SocialIconColor } from '../types';

/**
 * Block row layout: a row starts at the first block and at every block that
 * isn't `beside` its predecessor. Mirrors the block ops in web
 * apps/web/src/lib/studio/model.ts, keep in sync.
 */
export function blockRows(blocks: ContentBlock[]): number[][] {
  const rows: number[][] = [];
  blocks.forEach((b, i) => {
    if (i > 0 && b.style?.beside && rows.length) rows[rows.length - 1].push(i);
    else rows.push([i]);
  });
  return rows;
}

/** Width fractions for one row: explicit widths win, the rest share what's
 *  left (min 20%), then everything is scaled to fit in 1. */
export function rowFractions(blocks: ContentBlock[]): number[] {
  const set = blocks.map((b) => (b.style?.width != null ? Math.min(1, Math.max(0.2, b.style.width)) : null));
  const used = set.reduce<number>((a, v) => a + (v ?? 0), 0);
  const free = set.filter((v) => v == null).length;
  const share = free ? Math.max(0.2, (1 - used) / free) : 0;
  const raw = set.map((v) => v ?? share);
  const sum = raw.reduce((a, v) => a + v, 0);
  return sum > 1 ? raw.map((v) => v / sum) : raw;
}

/** Copy a block with a style patch, the base of every block op below. */
export const withStyle = (b: ContentBlock, patch: Partial<BlockStyle>): ContentBlock => ({ ...b, style: { ...(b.style ?? {}), ...patch } });

/** Remove a block, the next one inherits its row start if needed. */
export function removeBlock(blocks: ContentBlock[], id: string): ContentBlock[] {
  const i = blocks.findIndex((b) => b.id === id);
  if (i < 0) return blocks;
  const x = blocks[i];
  const rest = blocks.filter((_, j) => j !== i);
  if ((i === 0 || !x.style?.beside) && rest[i]?.style?.beside) rest[i] = withStyle(rest[i], { beside: false });
  return rest;
}

/** Swap with the neighbour, beside flags stay with the slots so row shapes hold. */
export function hopBlock(blocks: ContentBlock[], id: string, dir: -1 | 1): ContentBlock[] {
  const i = blocks.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= blocks.length) return blocks;
  const next = [...blocks];
  const a = next[i];
  const b = next[j];
  next[i] = withStyle(b, { beside: a.style?.beside });
  next[j] = withStyle(a, { beside: b.style?.beside });
  return next;
}

/** Copy right after the original, staying in its row if it has one. */
export function duplicateBlock(blocks: ContentBlock[], id: string): { blocks: ContentBlock[]; id: string | null } {
  const i = blocks.findIndex((b) => b.id === id);
  if (i < 0) return { blocks, id: null };
  const copy: ContentBlock = { ...JSON.parse(JSON.stringify(blocks[i])), id: uid('b') };
  const inRow = !!blocks[i].style?.beside || !!blocks[i + 1]?.style?.beside;
  const next = [...blocks];
  next.splice(i + 1, 0, withStyle(copy, { beside: inRow }));
  return { blocks: next, id: copy.id };
}

/** Frame aspect (w/h) of an image block as the canvas draws it: square 1:1,
 *  wide 16:9, custom = real frame width : imageH. Content width is 282
 *  design units; rows, width % and a box fill narrow the frame. Mirrors web
 *  model.ts imageFrameAspect, keep in sync. */
export function imageFrameAspect(b: ContentBlock, blocks: ContentBlock[]): number {
  const asp = b.imageAspect ?? (b.imageH !== undefined ? 'custom' : 'wide');
  if (asp === 'square') return 1;
  if (asp === 'wide') return 16 / 9;
  const row = blockRows(blocks).find((r) => r.some((i) => blocks[i].id === b.id)) ?? [];
  let cell = b.style?.width != null ? Math.min(1, Math.max(0.2, b.style.width)) : 1;
  if (row.length > 1) {
    const fr = rowFractions(row.map((i) => blocks[i]));
    cell = fr[row.findIndex((i) => blocks[i].id === b.id)] * (1 - (10 * (row.length - 1)) / 282);
  }
  const w = 282 * cell - (b.style?.boxBg ? 20 : 0);
  return Math.max(20, w) / Math.max(60, b.imageH ?? 140);
}

/* ------------------------------- placement -------------------------------- */
// Mirrors the placement helpers in web apps/web/src/lib/studio/model.ts.

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** View style for a placement; s = canvas px per design unit. */
export function placeStyle(p: Placement | undefined, s: number): ViewStyle | undefined {
  if (!p) return undefined;
  const t = [
    ...(p.dx ? [{ translateX: p.dx * s }] : []),
    ...(p.dy ? [{ translateY: p.dy * s }] : []),
    ...(p.rotate ? [{ rotate: `${clampN(p.rotate, -180, 180)}deg` }] : []),
  ];
  const out: ViewStyle = {
    ...(t.length ? { transform: t } : null),
    ...(p.opacity != null && p.opacity < 1 ? { opacity: clampN(p.opacity, 0.1, 1) } : null),
    ...(p.z ? { zIndex: p.z } : null),
  };
  return Object.keys(out).length ? out : undefined;
}

/** Patch that clears the move and rotation (opacity and layer stay). */
export const RESET_PLACE: Placement = { dx: undefined, dy: undefined, rotate: undefined };

/** What the canvas can place: one block, the title, or the profile row. */
export type PlaceTarget = { kind: 'block'; id: string } | { kind: 'title' } | { kind: 'pfp' };

export function placeOf(pg: PostPage, t: PlaceTarget): Placement {
  if (t.kind === 'block') return pg.blocks.find((b) => b.id === t.id)?.style ?? {};
  return (t.kind === 'title' ? pg.title.place : pg.pfp.place) ?? {};
}

export function patchPlace(pg: PostPage, t: PlaceTarget, patch: Placement): PostPage {
  if (t.kind === 'block') return { ...pg, blocks: pg.blocks.map((b) => (b.id === t.id ? withStyle(b, patch) : b)) };
  if (t.kind === 'title') return { ...pg, title: { ...pg.title, place: { ...(pg.title.place ?? {}), ...patch } } };
  return { ...pg, pfp: { ...pg.pfp, place: { ...(pg.pfp.place ?? {}), ...patch } } };
}

/** Default layer of the title and profile row: above the card (0). */
export const PART_Z = 1;

/** z that puts an element in front of / behind every sibling. */
export function layerZ(others: (number | undefined)[], where: 'front' | 'back'): number {
  const zs = others.map((z) => z ?? 0);
  return where === 'front' ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1;
}

/** Bring an element to the front, or send it to the back: a block among the
 *  card's blocks, the title / profile row against each other and the card. */
export function layerPlace(pg: PostPage, t: PlaceTarget, where: 'front' | 'back'): PostPage {
  const others =
    t.kind === 'block'
      ? pg.blocks.filter((b) => b.id !== t.id).map((b) => b.style?.z)
      : [(t.kind === 'title' ? pg.pfp.place?.z : pg.title.place?.z) ?? PART_Z];
  return patchPlace(pg, t, { z: layerZ(others, where) });
}

/** Disc / glyph / ring colours for one social icon (see web socialIconColors). */
export function socialIconColors(
  mode: SocialIconColor | undefined,
  outline: boolean,
  brand: string,
  clash: boolean,
  ring: string,
): { disc: string; glyph: string; border: string } {
  if (mode === 'black' || mode === 'white') {
    const c = mode === 'black' ? '#111111' : '#FFFFFF';
    if (outline) return { disc: 'transparent', glyph: c, border: c };
    return mode === 'black'
      ? { disc: c, glyph: '#FFFFFF', border: 'transparent' }
      : { disc: c, glyph: brand, border: 'transparent' };
  }
  if (outline) return { disc: 'transparent', glyph: clash ? ring : brand, border: clash ? ring : brand };
  return clash ? { disc: '#FFFFFF', glyph: brand, border: 'transparent' } : { disc: brand, glyph: '#FFFFFF', border: 'transparent' };
}
