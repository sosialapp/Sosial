'use client';

/**
 * CanvasEditLayer, direct manipulation over the live StudioCanvas: click a
 * block to select it, drag it to reorder or drop it beside another block,
 * drag the edge handles to resize width, the corner to scale its content,
 * the bottom handle for image / column height, and the card edge for the
 * fixed card height. Quick, opinionated tweaks, the layout engine stays
 * auto-flow, so nothing can be dragged off-canvas.
 *
 * It renders as a sibling overlay (never inside [data-studio-canvas]) so
 * exports never capture the chrome. Geometry is measured from the canvas
 * DOM via the data-block-id / data-block-row / data-studio-* markers.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Columns2, Copy, Trash2 } from 'lucide-react';
import {
  blockRows,
  maxCardHeightDesign,
  rowFractions,
  uid,
  type BlockStyle,
  type ContentBlock,
  type PostPage,
} from '@/lib/studio/model';

type Part = 'title' | 'pfp' | 'card';
type R = { x: number; y: number; w: number; h: number };

interface Geo {
  k: number;
  W: number;
  blocks: { id: string; r: R }[];
  rows: { ids: string[]; r: R }[];
  parts: { part: Part; r: R }[];
}

type DropTarget =
  | { kind: 'row'; ids: string[]; where: 'before' | 'after' }
  | { kind: 'beside'; id: string; where: 'before' | 'after' };

const SNAPS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const inside = (r: R, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const withStyle = (b: ContentBlock, patch: Partial<BlockStyle>): ContentBlock => ({ ...b, style: { ...(b.style ?? {}), ...patch } });
const isColumns = (b: ContentBlock) => (b.style?.chartVariant ?? (b.type === 'bar' ? 'hbar' : b.type)) === 'vbar';

/* ------------------------------ pure block ops ----------------------------- */

/** Pull a block out, the next block inherits its row start if needed. */
function detach(blocks: ContentBlock[], id: string): { rest: ContentBlock[]; x: ContentBlock | null } {
  const i = blocks.findIndex((b) => b.id === id);
  if (i < 0) return { rest: blocks, x: null };
  const x = blocks[i];
  const rest = blocks.filter((_, j) => j !== i);
  const startsRow = i === 0 || !x.style?.beside;
  if (startsRow && rest[i]?.style?.beside) rest[i] = withStyle(rest[i], { beside: false });
  return { rest, x };
}

function dropBlock(blocks: ContentBlock[], id: string, t: DropTarget): ContentBlock[] {
  const { rest, x } = detach(blocks, id);
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

/** Swap with the neighbour, the beside flags stay with the slots so the
 *  row shapes hold and the block just hops one place. */
function hop(blocks: ContentBlock[], id: string, dir: -1 | 1): ContentBlock[] {
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

export function duplicateBlock(blocks: ContentBlock[], id: string): { blocks: ContentBlock[]; id: string | null } {
  const i = blocks.findIndex((b) => b.id === id);
  if (i < 0) return { blocks, id: null };
  const copy: ContentBlock = { ...structuredClone(blocks[i]), id: uid('b') };
  const inRow = !!blocks[i].style?.beside || !!blocks[i + 1]?.style?.beside;
  const next = [...blocks];
  next.splice(i + 1, 0, withStyle(copy, { beside: inRow }));
  return { blocks: next, id: copy.id };
}

export function removeBlock(blocks: ContentBlock[], id: string): ContentBlock[] {
  return detach(blocks, id).rest;
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
        mode: 'press' | 'move' | 'e' | 'w' | 'se' | 's' | 'card';
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
      }
  >(null);

  const blocks = page.blocks;
  const selected = blocks.find((b) => b.id === selectedId) ?? null;

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
    setGeo({
      k: o.width / 340,
      W: o.width,
      blocks: blocks
        .map((b) => {
          const el = canvas.querySelector(`[data-block-id="${b.id}"]`);
          return el ? { id: b.id, r: rel(el) } : null;
        })
        .filter((v): v is { id: string; r: R } => !!v),
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
        edit((pg) => ({ ...pg, blocks: hop(pg.blocks, selectedId, e.key === 'ArrowUp' ? -1 : 1) }));
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

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = local(e);
    const id = blockAt(p.x, p.y);
    layerRef.current?.setPointerCapture(e.pointerId);
    gesture.current = {
      mode: 'press', id, px: e.clientX, py: e.clientY,
      r: id ? geo.blocks.find((b) => b.id === id)!.r : { x: 0, y: 0, w: 0, h: 0 },
      part: id ? null : partAt(p.x, p.y),
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
      if (!g.id || Math.hypot(dx, dy) < 5) return;
      g.mode = 'move';
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
    if (!g) return;
    if (g.mode === 'press') {
      if (g.id) return; // selected on down
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
        cursor: dragging ? 'grabbing' : hover && hover === selectedId ? 'grab' : hover ? 'pointer' : 'default',
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
                style={{
                  left: clamp(selR.x - 3, -8, geo.W - 150),
                  top: selR.y > 40 ? selR.y - 38 : selR.y + selR.h + 8,
                }}
              >
                <ToolBtn label="Move up (Alt+↑)" disabled={idx <= 0} onClick={() => edit((pg) => ({ ...pg, blocks: hop(pg.blocks, selected.id, -1) }))}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </ToolBtn>
                <ToolBtn label="Move down (Alt+↓)" disabled={idx >= blocks.length - 1} onClick={() => edit((pg) => ({ ...pg, blocks: hop(pg.blocks, selected.id, 1) }))}>
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
              </div>
            </>
          ) : null}
        </>
      ) : null}

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
