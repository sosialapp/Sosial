import { uid } from '../constants';
import { BlockStyle, ContentBlock } from '../types';

/**
 * Block row layout: a row starts at the first block and at every block that
 * isn't `beside` its predecessor. Mirrors web apps/web/src/lib/studio/model.ts
 * (blockRows / rowFractions) and the ops in CanvasEditLayer.tsx, keep in sync.
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

const withStyle = (b: ContentBlock, patch: Partial<BlockStyle>): ContentBlock => ({ ...b, style: { ...(b.style ?? {}), ...patch } });

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
 *  steps2.tsx frameAspectOf, keep in sync. */
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
