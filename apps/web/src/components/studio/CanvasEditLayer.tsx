'use client';

/**
 * CanvasEditLayer, direct manipulation over the live StudioCanvas: click a
 * block to select it, drag it to reorder or drop it beside another block,
 * drag the edge handles to resize width, the corner to scale its content,
 * the bottom handle for image / column height, and the card edge for the
 * fixed card height. The layout engine stays auto-flow; on top of it every
 * block, the title and the profile row can be moved freely (move grip or
 * Shift+drag on a block, plain drag on the title / profile), rotated with the
 * corner knob, faded, aligned and layered. Free moves are a saved offset
 * from the layout spot, so a template still reflows when its content changes.
 *
 * It renders as a sibling overlay (never inside [data-studio-canvas]) so
 * exports never capture the chrome. Geometry is measured from the canvas
 * DOM via the data-block-id / data-block-row / data-studio-* markers.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, ArrowDown, ArrowUp, BringToFront,
  Columns2, Copy, Droplet, Move, RotateCcw, RotateCw, SendToBack, Trash2,
} from 'lucide-react';
import {
  blockRows,
  detachBlock,
  duplicateBlock,
  hopBlock,
  layerPlace,
  maxCardHeightDesign,
  patchPlace,
  placeOf,
  removeBlock,
  RESET_PLACE,
  rowFractions,
  withStyle,
  type ContentBlock,
  type Placement,
  type PlaceTarget,
  type PostPage,
} from '@/lib/studio/model';

type Part = 'title' | 'pfp' | 'card';
type R = { x: number; y: number; w: number; h: number };

interface Geo {
  k: number;
  W: number;
  H: number;
  /** fit = AutoFit's scale on the card body (screen px per layout px);
   *  clip = the card body that clips the block (moves stay inside it). */
  blocks: { id: string; r: R; fit: number; clip: R | undefined }[];
  rows: { ids: string[]; r: R }[];
  parts: { part: Part; r: R }[];
}

type DropTarget =
  | { kind: 'row'; ids: string[]; where: 'before' | 'after' }
  | { kind: 'beside'; id: string; where: 'before' | 'after' };

const SNAPS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1];
/** Free moves snap to the canvas centre lines and the layout spot. */
const SNAP_PX = 5;
type Align = 'left' | 'center' | 'right';
const NEXT_ALIGN: Record<Align, Align> = { left: 'center', center: 'right', right: 'left' };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const inside = (r: R, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const isColumns = (b: ContentBlock) => (b.style?.chartVariant ?? (b.type === 'bar' ? 'hbar' : b.type)) === 'vbar';

/* ------------------------------ drop placement ----------------------------- */

function dropBlock(blocks: ContentBlock[], id: string, t: DropTarget): ContentBlock[] {
  const { rest, x } = detachBlock(blocks, id);
  if (!x) return blocks;
  const next = [...rest];
  if (t.kind === 'row') {
    const anchor = t.where === 'before' ? t.ids[0] : t.ids[t.ids.length - 1];
    const ai = next.findIndex((b) => b.id === anchor);
    if (ai < 0) return blocks;
    next.splice(t.where === 'before' ? ai : ai + 1, 0, withStyle(x, { beside: false }));
    return next;
  }
  const bi = next.findIndex((b) => b.id === t.id);
  if (bi < 0) return blocks;
  if (t.where === 'before') {
    const b = next[bi];
    next[bi] = withStyle(b, { beside: true });
    next.splice(bi, 0, withStyle(x, { beside: bi > 0 && !!b.style?.beside }));
  } else {
    next.splice(bi + 1, 0, withStyle(x, { beside: true }));
  }
  // Fresh side-by-side rows split evenly, resize from there.
  const row = blockRows(next).find((r) => r.some((i) => next[i].id === x.id)) ?? [];
  row.forEach((i) => {
    next[i] = withStyle(next[i], { width: undefined });
  });
  return next;
}

/* --------------------------------- layer ---------------------------------- */

export default function CanvasEditLayer({
  hostRef,
  page,
  designH,
  selectedId,
  onSelect,
  onPart,
  edit,
  begin,
  live,
  end,
}: {
  hostRef: React.RefObject<HTMLDivElement | null>;
  page: PostPage;
  /** Design-unit canvas height (340 × ratio), bounds the card height drag. */
  designH: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPart: (part: Part) => void;
  /** One committed edit (one undo step). */
  edit: (fn: (pg: PostPage) => PostPage) => void;
  /** Gesture: begin snapshots, live updates without history, end commits. */
  begin: () => void;
  live: (fn: (pg: PostPage) => PostPage) => void;
  end: () => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [tick, setTick] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  // Mirror for pointerup: a fast drag can release before the state renders.
  const dropRef = useRef<DropTarget | null>(null);
  const [ghost, setGhost] = useState<R | null>(null);
  const [badge, setBadge] = useState<{ x: number; y: number; text: string } | null>(null);
  const gesture = useRef<
    | null
    | {
        mode: 'press' | 'move' | 'drag' | 'rotate' | 'e' | 'w' | 'se' | 's' | 'card';
        id: string | null;
        px: number;
        py: number;
        r: R;
        block?: ContentBlock;
        /** px width that 100% maps to (row content minus gaps) */
        avail?: number;
        factor?: number;
        cardH?: number;
        cardSign?: number;
        part?: Part | null;
        /** Shift held at press: a block drag moves freely instead of reordering. */
        free?: boolean;
        target?: PlaceTarget;
        p0?: Placement;
        fit?: number;
        /** Blocks stay inside the card body that clips them. */
        clip?: R;
        /** rotate: pointer angle at press, degrees */
        a0?: number;
      }
  >(null);
  // Title / profile row selection (blocks use selectedId from the editor).
  const [selPart, setSelPart] = useState<'title' | 'pfp' | null>(null);
  const [guides, setGuides] = useState<{ v?: number; h?: number }>({});
  const [opaOpen, setOpaOpen] = useState(false);

  const blocks = page.blocks;
  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  // One selection at a time: picking a block drops the part, and the part
  // never survives a page flip.
  useEffect(() => {
    if (selectedId) setSelPart(null);
  }, [selectedId]);
  useEffect(() => {
    setSelPart(null);
    setOpaOpen(false);
  }, [page.id]);
  useEffect(() => setOpaOpen(false), [selectedId, selPart]);

  /* ------------------------------- measuring ------------------------------ */

  useLayoutEffect(() => {
    const host = hostRef.current;
    const canvas = host?.querySelector<HTMLElement>('[data-studio-canvas]');
    if (!host || !canvas) return;
    const o = canvas.getBoundingClientRect();
    const rel = (el: Element): R => {
      const b = el.getBoundingClientRect();
      return { x: b.left - o.left, y: b.top - o.top, w: b.width, h: b.height };
    };
    const rowsIdx = blockRows(blocks);
    const rowEls = Array.from(canvas.querySelectorAll('[data-block-row]'));
    const parts: Geo['parts'] = [];
    const title = canvas.querySelector('[data-studio-part="title"]');
    const pfp = canvas.querySelector('[data-studio-part="pfp"]');
    const card = canvas.querySelector('[data-studio-card]');
    if (card) parts.push({ part: 'card', r: rel(card) });
    if (title) parts.push({ part: 'title', r: rel(title) });
    if (pfp) parts.push({ part: 'pfp', r: rel(pfp) });
    // AutoFit scales the card body; the block's parent is never transformed
    // itself, so its drawn / layout width ratio is that scale.
    const fitOf = (el: Element) => {
      const p = el.parentElement;
      return p && p.offsetWidth ? p.getBoundingClientRect().width / p.offsetWidth : 1;
    };
    const clipOf = (el: Element): R | undefined => {
      for (let p = el.parentElement; p && p !== canvas; p = p.parentElement) {
        if (getComputedStyle(p).overflow === 'hidden') return rel(p);
      }
      return undefined;
    };
    setGeo({
      k: o.width / 340,
      W: o.width,
      H: o.height,
      blocks: blocks
        .map((b) => {
          const el = canvas.querySelector(`[data-block-id="${b.id}"]`);
          return el ? { id: b.id, r: rel(el), fit: fitOf(el), clip: clipOf(el) } : null;
        })
        .filter((v): v is Geo['blocks'][number] => !!v),
      rows: rowsIdx.map((ids, i) => ({ ids: ids.map((j) => blocks[j].id), r: rowEls[i] ? rel(rowEls[i]) : { x: 0, y: 0, w: 0, h: 0 } })),
      parts,
    });
  }, [hostRef, page, blocks, tick]);

  // Re-measure when anything inside the canvas changes size (images
  // loading, AutoFit rescaling, the stage resizing).
  useEffect(() => {
    const host = hostRef.current;
    const canvas = host?.querySelector<HTMLElement>('[data-studio-canvas]');
    if (!canvas) return;
    let raf = 0;
    const bump = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setTick((t) => t + 1));
    };
    const ro = new ResizeObserver(bump);
    ro.observe(canvas);
    canvas.querySelectorAll('[data-block-id], [data-studio-card]').forEach((el) => ro.observe(el));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [hostRef, page]);

  /* -------------------------------- keyboard ------------------------------ */

  useEffect(() => {
    if (!selPart) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelPart(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selPart]);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.key === 'Escape') {
        onSelect(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        edit((pg) => ({ ...pg, blocks: removeBlock(pg.blocks, selectedId) }));
        onSelect(null);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const res = duplicateBlock(blocks, selectedId);
        edit((pg) => ({ ...pg, blocks: res.blocks }));
        if (res.id) onSelect(res.id);
      } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        edit((pg) => ({ ...pg, blocks: hopBlock(pg.blocks, selectedId, e.key === 'ArrowUp' ? -1 : 1) }));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedId, blocks, edit, onSelect]);

  if (!geo) return <div ref={layerRef} className="absolute inset-0" />;

  /* -------------------------------- hit tests ----------------------------- */

  const local = (e: React.PointerEvent) => {
    const b = layerRef.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const blockAt = (x: number, y: number) => geo.blocks.find((b) => inside(b.r, x, y))?.id ?? null;
  // Title / profile win over the card; the card only counts when no block hit.
  const partAt = (x: number, y: number): Part | null =>
    geo.parts.find((p) => p.part !== 'card' && inside(p.r, x, y))?.part ??
    (geo.parts.find((p) => p.part === 'card' && inside(p.r, x, y)) ? 'card' : null);

  const dropAt = (x: number, y: number, dragId: string): DropTarget | null => {
    for (const b of geo.blocks) {
      if (b.id === dragId || !inside(b.r, x, y)) continue;
      const zone = (x - b.r.x) / Math.max(1, b.r.w);
      if (zone < 0.25) return { kind: 'beside', id: b.id, where: 'before' };
      if (zone > 0.75) return { kind: 'beside', id: b.id, where: 'after' };
      const row = geo.rows.find((r) => r.ids.includes(b.id))!;
      const ids = row.ids.filter((i) => i !== dragId);
      return { kind: 'row', ids, where: y < row.r.y + row.r.h / 2 ? 'before' : 'after' };
    }
    const rows = geo.rows.map((r) => ({ ...r, ids: r.ids.filter((i) => i !== dragId) })).filter((r) => r.ids.length);
    if (!rows.length) return null;
    const hit = rows.find((r) => y < r.r.y + r.r.h / 2);
    return hit ? { kind: 'row', ids: hit.ids, where: 'before' } : { kind: 'row', ids: rows[rows.length - 1].ids, where: 'after' };
  };

  /** Would this drop change anything? (dropping a block next to itself) */
  const noop = (t: DropTarget, id: string) => {
    const next = dropBlock(blocks, id, t);
    return JSON.stringify(next) === JSON.stringify(blocks);
  };

  /* -------------------------------- gestures ------------------------------ */

  const startHandle = (mode: 'e' | 'w' | 'se' | 's') => (e: React.PointerEvent) => {
    if (!selected) return;
    e.stopPropagation();
    e.preventDefault();
    const r = geo.blocks.find((b) => b.id === selected.id)?.r;
    const row = geo.rows.find((rw) => rw.ids.includes(selected.id));
    if (!r || !row) return;
    let avail = row.r.w;
    let factor = 1;
    if (row.ids.length > 1) {
      const members = row.ids.map((id) => blocks.find((b) => b.id === id)!);
      const fr = rowFractions(members);
      const widths = row.ids.map((id) => geo.blocks.find((b) => b.id === id)?.r.w ?? 0);
      avail = widths.reduce((a, v) => a + v, 0) / Math.max(0.01, fr.reduce((a, v) => a + v, 0));
    } else if ((selected.style?.align ?? 'left') === 'center') {
      factor = 2;
    }
    layerRef.current?.setPointerCapture(e.pointerId);
    gesture.current = { mode, id: selected.id, px: e.clientX, py: e.clientY, r, block: selected, avail, factor };
    begin();
  };

  const card = geo.parts.find((p) => p.part === 'card');
  const cardY = ((page.cardY as string) === 'fill' ? 'top' : page.cardY) ?? 'top';
  const cardHandleTop = cardY === 'bottom';
  const startCard = (e: React.PointerEvent) => {
    if (!card) return;
    e.stopPropagation();
    e.preventDefault();
    layerRef.current?.setPointerCapture(e.pointerId);
    gesture.current = {
      mode: 'card', id: null, px: e.clientX, py: e.clientY, r: card.r,
      cardH: page.cardH ?? Math.round(card.r.h / geo.k),
      cardSign: cardHandleTop ? -1 : 1,
      factor: cardY === 'middle' ? 2 : 1,
    };
    begin();
  };

  /** Rect + AutoFit scale of a placeable element, as measured now. */
  const rectOf = (t: PlaceTarget): { r: R; fit: number; clip?: R } | null => {
    if (t.kind === 'block') {
      const b = geo.blocks.find((x) => x.id === t.id);
      return b ? { r: b.r, fit: b.fit, clip: b.clip } : null;
    }
    const pr = geo.parts.find((x) => x.part === t.kind)?.r;
    return pr ? { r: pr, fit: 1 } : null;
  };

  const startDrag = (t: PlaceTarget) => (e: React.PointerEvent) => {
    const m = rectOf(t);
    if (!m) return;
    e.stopPropagation();
    e.preventDefault();
    layerRef.current?.setPointerCapture(e.pointerId);
    gesture.current = { mode: 'drag', id: null, px: e.clientX, py: e.clientY, r: m.r, fit: m.fit, clip: m.clip, target: t, p0: placeOf(page, t) };
    begin();
  };

  const startRotate = (t: PlaceTarget) => (e: React.PointerEvent) => {
    const m = rectOf(t);
    if (!m) return;
    e.stopPropagation();
    e.preventDefault();
    const p = local(e);
    const a0 = (Math.atan2(p.y - (m.r.y + m.r.h / 2), p.x - (m.r.x + m.r.w / 2)) * 180) / Math.PI;
    layerRef.current?.setPointerCapture(e.pointerId);
    gesture.current = { mode: 'rotate', id: null, px: e.clientX, py: e.clientY, r: m.r, target: t, p0: placeOf(page, t), a0 };
    begin();
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = local(e);
    const id = blockAt(p.x, p.y);
    layerRef.current?.setPointerCapture(e.pointerId);
    gesture.current = {
      mode: 'press', id, px: e.clientX, py: e.clientY,
      r: id ? geo.blocks.find((b) => b.id === id)!.r : { x: 0, y: 0, w: 0, h: 0 },
      part: id ? null : partAt(p.x, p.y),
      free: e.shiftKey,
    };
    if (id && id !== selectedId) onSelect(id);
  };

  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    const p = local(e);
    if (!g) {
      setHover(blockAt(p.x, p.y) ?? partAt(p.x, p.y));
      return;
    }
    const dx = e.clientX - g.px;
    const dy = e.clientY - g.py;
    if (g.mode === 'press') {
      if (Math.hypot(dx, dy) < 5) return;
      // Title / profile row: a drag moves it freely. Blocks reorder, unless
      // Shift was held (or the move grip used).
      const t: PlaceTarget | null =
        g.id && g.free ? { kind: 'block', id: g.id } : !g.id && (g.part === 'title' || g.part === 'pfp') ? { kind: g.part } : null;
      if (t) {
        const m = rectOf(t);
        if (!m) return;
        if (t.kind !== 'block') {
          setSelPart(t.kind);
          onSelect(null);
        }
        Object.assign(g, { mode: 'drag', r: m.r, fit: m.fit, clip: m.clip, target: t, p0: placeOf(page, t) });
        begin();
      } else {
        if (!g.id) return;
        g.mode = 'move';
      }
    }
    if (g.mode === 'drag' && g.target && g.p0) {
      const u = geo.k * (g.fit ?? 1);
      const p0x = (g.p0.dx ?? 0) * u;
      const p0y = (g.p0.dy ?? 0) * u;
      const cx = g.r.x + g.r.w / 2;
      const cy = g.r.y + g.r.h / 2;
      // Bounds: the whole canvas for the title / profile row; for a block,
      // the card body (outside it the block would be clipped away).
      const box = g.clip ?? { x: 0, y: 0, w: geo.W, h: geo.H };
      const fitIn = (d: number, lo: number, len: number, boxLo: number, boxLen: number) =>
        len <= boxLen ? clamp(d, boxLo - lo, boxLo + boxLen - lo - len) : clamp(d, boxLo - lo - len / 2, boxLo + boxLen - lo - len / 2);
      let mx = g.clip ? fitIn(dx, g.r.x, g.r.w, box.x, box.w) : clamp(dx, -cx, geo.W - cx);
      let my = g.clip ? fitIn(dy, g.r.y, g.r.h, box.y, box.h) : clamp(dy, -cy, geo.H - cy);
      const gd: { v?: number; h?: number } = {};
      if (Math.abs(cx + mx - geo.W / 2) < SNAP_PX) {
        mx = geo.W / 2 - cx;
        gd.v = geo.W / 2;
      } else if (Math.abs(p0x + mx) < SNAP_PX) mx = -p0x;
      if (Math.abs(cy + my - geo.H / 2) < SNAP_PX) {
        my = geo.H / 2 - cy;
        gd.h = geo.H / 2;
      } else if (Math.abs(p0y + my) < SNAP_PX) my = -p0y;
      const nx = Math.round(((p0x + mx) / u) * 2) / 2;
      const ny = Math.round(((p0y + my) / u) * 2) / 2;
      const t = g.target;
      live((pg) => patchPlace(pg, t, { dx: nx || undefined, dy: ny || undefined }));
      setGuides(gd);
      setBadge({ x: p.x, y: p.y - 28, text: `${Math.round(nx)}, ${Math.round(ny)}` });
      return;
    }
    if (g.mode === 'rotate' && g.target && g.p0) {
      const a = (Math.atan2(p.y - (g.r.y + g.r.h / 2), p.x - (g.r.x + g.r.w / 2)) * 180) / Math.PI;
      let v = (g.p0.rotate ?? 0) + a - (g.a0 ?? 0);
      v = ((((v + 180) % 360) + 360) % 360) - 180;
      // Shift = 15 degree steps; otherwise a soft snap to the right angles.
      const step = e.shiftKey ? 15 : 45;
      const near = Math.round(v / step) * step;
      v = e.shiftKey || Math.abs(near - v) < 4 ? near : Math.round(v);
      if (v === -180) v = 180;
      const t = g.target;
      live((pg) => patchPlace(pg, t, { rotate: v || undefined }));
      setBadge({ x: p.x, y: p.y - 28, text: `${v}°` });
      return;
    }
    if (g.mode === 'move' && g.id) {
      setGhost({ ...g.r, x: g.r.x + dx, y: g.r.y + dy });
      const t = dropAt(p.x, p.y, g.id);
      dropRef.current = t && !noop(t, g.id) ? t : null;
      setDrop(dropRef.current);
      return;
    }
    if ((g.mode === 'e' || g.mode === 'w') && g.block && g.avail) {
      const raw = (g.r.w + (g.mode === 'e' ? dx : -dx) * (g.factor ?? 1)) / g.avail;
      let v = clamp(raw, 0.2, 1);
      const snap = SNAPS.find((s) => Math.abs(s - v) < 0.02);
      if (snap) v = snap;
      v = Math.round(v * 1000) / 1000;
      const id = g.block.id;
      live((pg) => ({ ...pg, blocks: pg.blocks.map((b) => (b.id === id ? withStyle(b, { width: v >= 1 ? 1 : v }) : b)) }));
      setBadge({ x: p.x, y: p.y - 28, text: `${Math.round(v * 100)}%` });
      return;
    }
    if (g.mode === 'se' && g.block) {
      const s0 = g.block.style?.scale ?? 1;
      // Diagonal drag: average the two axes against the block's size.
      const f = 1 + (dx / Math.max(40, g.r.w) + dy / Math.max(40, g.r.h)) / 2;
      const v = Math.round(clamp(s0 * f, 0.5, 2.5) * 20) / 20;
      const id = g.block.id;
      live((pg) => ({ ...pg, blocks: pg.blocks.map((b) => (b.id === id ? withStyle(b, { scale: v }) : b)) }));
      setBadge({ x: p.x, y: p.y - 28, text: `${Math.round(v * 100)}%` });
      return;
    }
    if (g.mode === 's' && g.block) {
      const b0 = g.block;
      const id = b0.id;
      const dd = dy / geo.k;
      if (b0.type === 'image') {
        const asp = b0.imageAspect ?? (b0.imageH !== undefined ? 'custom' : 'wide');
        const h0 = asp === 'custom' ? (b0.imageH ?? 140) : asp === 'square' ? 282 : (282 * 9) / 16;
        const v = Math.round(clamp(h0 + dd, 60, 420));
        live((pg) => ({ ...pg, blocks: pg.blocks.map((b) => (b.id === id ? { ...b, imageAspect: 'custom', imageH: v } : b)) }));
        setBadge({ x: p.x, y: p.y - 28, text: `${v}px` });
      } else {
        const c0 = b0.style?.chartHeight ?? 1;
        const v = Math.round(clamp(c0 + dd / 99, 0.4, 1.6) * 20) / 20;
        live((pg) => ({ ...pg, blocks: pg.blocks.map((b) => (b.id === id ? withStyle(b, { chartHeight: v }) : b)) }));
        setBadge({ x: p.x, y: p.y - 28, text: `${Math.round(v * 100)}%` });
      }
      return;
    }
    if (g.mode === 'card' && g.cardH != null) {
      const max = Math.max(120, Math.min(640, Math.floor(maxCardHeightDesign(page, designH))));
      const v = Math.round(clamp(g.cardH + ((g.cardSign ?? 1) * dy * (g.factor ?? 1)) / geo.k, 120, max) / 2) * 2;
      live((pg) => ({ ...pg, cardH: v, cardY: ((pg.cardY as string) === 'fill' ? 'top' : pg.cardY) ?? 'top' }));
      setBadge({ x: p.x, y: p.y - 28, text: `${v}px` });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    layerRef.current?.releasePointerCapture?.(e.pointerId);
    setGhost(null);
    setBadge(null);
    setGuides({});
    if (!g) return;
    if (g.mode === 'press') {
      if (g.id) return; // selected on down
      setSelPart(g.part === 'title' || g.part === 'pfp' ? g.part : null);
      if (g.part) onPart(g.part);
      onSelect(null);
      return;
    }
    if (g.mode === 'move') {
      const t = dropRef.current;
      dropRef.current = null;
      setDrop(null);
      if (t && g.id) {
        const id = g.id;
        edit((pg) => ({ ...pg, blocks: dropBlock(pg.blocks, id, t) }));
      }
      return;
    }
    end();
  };

  /* --------------------------------- render ------------------------------- */

  const selR = selected ? geo.blocks.find((b) => b.id === selected.id)?.r : undefined;
  const hovR = hover && hover !== selectedId
    ? geo.blocks.find((b) => b.id === hover)?.r ?? geo.parts.find((p) => p.part === hover)?.r
    : undefined;
  const idx = selected ? blocks.findIndex((b) => b.id === selected.id) : -1;
  const dragging = !!ghost;

  let dropLine: React.CSSProperties | null = null;
  if (drop && dragging) {
    if (drop.kind === 'row') {
      const row = geo.rows.find((r) => r.ids.includes(drop.ids[0]));
      if (row) {
        const y = drop.where === 'before' ? row.r.y - 3 : row.r.y + row.r.h + 2;
        dropLine = { left: row.r.x, top: y, width: row.r.w, height: 3 };
      }
    } else {
      const b = geo.blocks.find((bb) => bb.id === drop.id)?.r;
      if (b) dropLine = { left: drop.where === 'before' ? b.x - 3 : b.x + b.w + 1, top: b.y, width: 3, height: b.h };
    }
  }

  const handle = 'absolute z-10 rounded-full border-2 border-white bg-[#4D7CFE] shadow';
  const showH = selected && (selected.type === 'image' || isColumns(selected));

  /* ------------------------- placement tools (shared) ---------------------- */

  const partR = selPart ? geo.parts.find((p) => p.part === selPart)?.r : undefined;
  const partTarget: PlaceTarget | null = selPart && partR ? { kind: selPart } : null;

  const alignOf = (t: PlaceTarget): Align =>
    t.kind === 'block'
      ? (blocks.find((b) => b.id === t.id)?.style?.align ?? 'left')
      : t.kind === 'title'
        ? page.title.align
        : (page.pfp.align ?? 'left');
  const setAlign = (t: PlaceTarget, a: Align) =>
    edit((pg) =>
      t.kind === 'block'
        ? { ...pg, blocks: pg.blocks.map((b) => (b.id === t.id ? withStyle(b, { align: a }) : b)) }
        : t.kind === 'title'
          ? { ...pg, title: { ...pg.title, align: a } }
          : { ...pg, pfp: { ...pg.pfp, align: a } },
    );

  /** Move grip, align, layer, opacity and reset, for any placeable element. */
  const placeTools = (t: PlaceTarget) => {
    const pl = placeOf(page, t);
    const al = alignOf(t);
    const AlignIcon = al === 'center' ? AlignHorizontalJustifyCenter : al === 'right' ? AlignHorizontalJustifyEnd : AlignHorizontalJustifyStart;
    const opa = Math.round((pl.opacity ?? 1) * 100);
    return (
      <>
        <span
          onPointerDown={startDrag(t)}
          title="Drag to move freely"
          aria-label="Drag to move freely"
          className="flex h-7 w-7 cursor-move items-center justify-center rounded-lg text-soft transition hover:bg-paper hover:text-ink"
        >
          <Move className="h-3.5 w-3.5" />
        </span>
        <ToolBtn label={`Align: ${al} (click for ${NEXT_ALIGN[al]})`} onClick={() => setAlign(t, NEXT_ALIGN[al])}>
          <AlignIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label="Bring to front" onClick={() => edit((pg) => layerPlace(pg, t, 'front'))}>
          <BringToFront className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label="Send to back" onClick={() => edit((pg) => layerPlace(pg, t, 'back'))}>
          <SendToBack className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label={`Opacity ${opa}%`} active={opaOpen || opa < 100} onClick={() => setOpaOpen((v) => !v)}>
          <Droplet className="h-3.5 w-3.5" />
        </ToolBtn>
        {pl.dx || pl.dy || pl.rotate ? (
          <ToolBtn label="Reset position and rotation" onClick={() => edit((pg) => patchPlace(pg, t, RESET_PLACE))}>
            <RotateCcw className="h-3.5 w-3.5" />
          </ToolBtn>
        ) : null}
        {opaOpen ? (
          <div className="absolute left-0 top-full mt-1.5 flex items-center gap-2 rounded-xl border border-line bg-card px-2.5 py-1.5 shadow-lg">
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={opa}
              aria-label="Opacity"
              onPointerDown={begin}
              onPointerUp={end}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                live((pg) => patchPlace(pg, t, { opacity: v >= 1 ? undefined : v }));
              }}
              className="w-28 accent-[#4D7CFE]"
            />
            <span className="w-9 text-right text-[11px] font-bold tabular-nums text-soft">{opa}%</span>
          </div>
        ) : null}
      </>
    );
  };

  /** Corner knob: drag to rotate (Shift = 15 degree steps). */
  const rotKnob = (t: PlaceTarget, r: R) => (
    <span
      onPointerDown={startRotate(t)}
      title="Drag to rotate (Shift: 15° steps)"
      className="absolute z-10 flex h-5 w-5 cursor-grab items-center justify-center rounded-full border border-line bg-card text-soft shadow transition hover:text-[#4D7CFE]"
      style={{ left: r.x - 22, top: r.y + r.h + 4 }}
    >
      <RotateCw className="h-3 w-3" />
    </span>
  );
  const toolbarLeft = (r: R, n: number) => clamp(r.x - 3, -8, geo.W - n * 28 - 4);
  const toolbarTop = (r: R) => (r.y > 40 ? r.y - 38 : r.y + r.h + 8);

  return (
    <div
      ref={layerRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={() => !gesture.current && setHover(null)}
      className="absolute inset-0 select-none"
      style={{
        cursor: dragging ? 'grabbing' : hover && (hover === selectedId || hover === 'title' || hover === 'pfp') ? 'grab' : hover ? 'pointer' : 'default',
        touchAction: selectedId ? 'none' : 'pan-y',
      }}
    >
      {hovR && !dragging ? (
        <span className="pointer-events-none absolute rounded-md border border-dashed border-[#4D7CFE]" style={{ left: hovR.x - 2, top: hovR.y - 2, width: hovR.w + 4, height: hovR.h + 4 }} />
      ) : null}

      {/* card height handle */}
      {card && !page.fullCard && !dragging ? (
        <span
          onPointerDown={startCard}
          title="Drag to set the card height"
          className="absolute z-10 h-2 w-10 cursor-ns-resize rounded-full border border-white bg-[#11111166] transition hover:bg-[#4D7CFE]"
          style={{ left: card.r.x + card.r.w / 2 - 20, top: (cardHandleTop ? card.r.y : card.r.y + card.r.h) - 4 }}
        />
      ) : null}

      {selR && selected ? (
        <>
          <span
            className="pointer-events-none absolute rounded-md border-2 border-[#4D7CFE]"
            style={{ left: selR.x - 3, top: selR.y - 3, width: selR.w + 6, height: selR.h + 6, opacity: dragging ? 0.35 : 1 }}
          />
          {!dragging ? (
            <>
              <span onPointerDown={startHandle('w')} title="Drag to resize width" className={`${handle} h-6 w-2.5 cursor-ew-resize`} style={{ left: selR.x - 7, top: selR.y + selR.h / 2 - 12 }} />
              <span onPointerDown={startHandle('e')} title="Drag to resize width" className={`${handle} h-6 w-2.5 cursor-ew-resize`} style={{ left: selR.x + selR.w - 3, top: selR.y + selR.h / 2 - 12 }} />
              {selected.type !== 'image' ? (
                <span onPointerDown={startHandle('se')} title="Drag to scale" className={`${handle} h-3.5 w-3.5 cursor-nwse-resize !rounded-[4px]`} style={{ left: selR.x + selR.w - 4, top: selR.y + selR.h - 4 }} />
              ) : null}
              {showH ? (
                <span onPointerDown={startHandle('s')} title="Drag to resize height" className={`${handle} h-2.5 w-6 cursor-ns-resize`} style={{ left: selR.x + selR.w / 2 - 12, top: selR.y + selR.h - 3 }} />
              ) : null}

              {/* floating quick toolbar */}
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute z-20 flex items-center gap-0.5 rounded-xl border border-line bg-card p-0.5 shadow-lg"
                style={{ left: toolbarLeft(selR, 11), top: toolbarTop(selR) }}
              >
                <ToolBtn label="Move up (Alt+↑)" disabled={idx <= 0} onClick={() => edit((pg) => ({ ...pg, blocks: hopBlock(pg.blocks, selected.id, -1) }))}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </ToolBtn>
                <ToolBtn label="Move down (Alt+↓)" disabled={idx >= blocks.length - 1} onClick={() => edit((pg) => ({ ...pg, blocks: hopBlock(pg.blocks, selected.id, 1) }))}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </ToolBtn>
                <ToolBtn
                  label={selected.style?.beside ? 'Own row' : 'Beside previous'}
                  active={!!selected.style?.beside && idx > 0}
                  disabled={idx <= 0}
                  onClick={() => {
                    const on = !selected.style?.beside;
                    edit((pg) => ({
                      ...pg,
                      blocks: pg.blocks.map((b) => (b.id === selected.id ? withStyle(b, { beside: on, width: undefined }) : b)),
                    }));
                  }}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                </ToolBtn>
                <ToolBtn
                  label="Duplicate (Ctrl+D)"
                  onClick={() => {
                    const res = duplicateBlock(blocks, selected.id);
                    edit((pg) => ({ ...pg, blocks: res.blocks }));
                    if (res.id) onSelect(res.id);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </ToolBtn>
                <ToolBtn
                  label="Delete (Del)"
                  danger
                  onClick={() => {
                    edit((pg) => ({ ...pg, blocks: removeBlock(pg.blocks, selected.id) }));
                    onSelect(null);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </ToolBtn>
                <span className="mx-0.5 h-4 w-px bg-line" aria-hidden="true" />
                {placeTools({ kind: 'block', id: selected.id })}
              </div>
              {rotKnob({ kind: 'block', id: selected.id }, selR)}
            </>
          ) : null}
        </>
      ) : null}

      {/* title / profile row selection */}
      {partTarget && partR ? (
        <>
          <span
            className="pointer-events-none absolute rounded-md border-2 border-[#4D7CFE]"
            style={{ left: partR.x - 3, top: partR.y - 3, width: partR.w + 6, height: partR.h + 6 }}
          />
          {!badge ? (
            <>
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute z-20 flex items-center gap-0.5 rounded-xl border border-line bg-card p-0.5 shadow-lg"
                style={{ left: toolbarLeft(partR, 6), top: toolbarTop(partR) }}
              >
                {placeTools(partTarget)}
              </div>
              {rotKnob(partTarget, partR)}
            </>
          ) : null}
        </>
      ) : null}

      {/* snap guides */}
      {guides.v != null ? <span className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-[#EC4899]" style={{ left: guides.v }} /> : null}
      {guides.h != null ? <span className="pointer-events-none absolute left-0 right-0 z-20 h-px bg-[#EC4899]" style={{ top: guides.h }} /> : null}

      {ghost ? (
        <span className="pointer-events-none absolute rounded-md border-2 border-[#4D7CFE] bg-[#4D7CFE1A]" style={{ left: ghost.x, top: ghost.y, width: ghost.w, height: ghost.h }} />
      ) : null}
      {dropLine ? <span className="pointer-events-none absolute z-20 rounded-full bg-[#4D7CFE]" style={dropLine} /> : null}
      {badge ? (
        <span className="pointer-events-none absolute z-30 rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-paper" style={{ left: badge.x + 10, top: badge.y }}>
          {badge.text}
        </span>
      ) : null}
    </div>
  );
}

function ToolBtn({
  label,
  onClick,
  disabled,
  active,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition disabled:opacity-30 ${
        active ? 'bg-ink text-paper' : danger ? 'text-[#9F2F2D] hover:bg-[#FDEBEC] dark:text-[#f2a8a8] dark:hover:bg-[#2c1b1b]' : 'text-soft hover:bg-paper hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
