'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CARD_STYLES,
  DATA,
  PALETTE,
  POST_SIZES,
  maxCardHeightDesign,
  newBlock,
  parseChartLine,
  blockRows,
  rowFractions,
  type BlockType,
  type ContentBlock,
  type PostSizeId,
  type StudioProject,
} from '@/lib/studio/model';
import { EmojiInput, EmojiTextarea } from '@/components/Emoji';
import { Field, Seg, Stepper, Swatches, SwitchRow } from './controls';
import { fileToDataUrl } from './steps1';
import { duplicateBlock, removeBlock } from './CanvasEditLayer';
import type { StepApi } from './steps1';
import { MAX_CROP_ZOOM, cropToRect, isCropV2, rectToCrop, type ImageCrop } from '@/lib/studio/crop';

const BLOCK_TYPES: { id: BlockType; label: string }[] = [
  { id: 'bullets', label: 'Bullets' },
  { id: 'numbered', label: 'Numbers' },
  { id: 'table', label: 'Table' },
  { id: 'bar', label: 'Chart' },
  { id: 'vbar', label: 'Columns' },
  { id: 'free', label: 'Text' },
  { id: 'image', label: 'Image' },
];

/** Saved 'fill' values (short-lived experiment) behave as 'top'. */
function normCardY(c?: string | null): 'top' | 'middle' | 'bottom' | undefined {
  if (c === 'fill') return 'top';
  return (c as 'top' | 'middle' | 'bottom' | undefined) ?? undefined;
}

/** Frame aspect (w/h) of an image block, must match the canvas renderer
 *  (blocks.tsx): square 1:1, wide 16:9, custom = real frame width : imageH.
 *  Content width is 282 design units (340 minus the canvas pad 16×2 and the
 *  card pad 13×2); rows, width % and a box fill narrow the frame. */
function frameAspectOf(b: ContentBlock, blocks: ContentBlock[]): number {
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

type CropRect = { x: number; y: number; w: number; h: number };

/**
 * Crop editor: the photo sits contain-fit in a dark stage with an
 * aspect-locked crop rectangle (the block's frame shape) over it. Drag
 * inside to move, drag a corner to resize (the opposite corner stays put),
 * scroll or use the slider to zoom. The rect maps to the v2 crop model in
 * lib/studio/crop.ts, which both renderers lay out in exact px.
 * Mirrors mobile ImageCropModal, keep in sync.
 */
function CropEditor({
  uri,
  aspect,
  value,
  onChange,
  onReset,
}: {
  uri: string;
  aspect: number;
  value?: ImageCrop;
  onChange: (c: ImageCrop) => void;
  onReset: () => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<CropRect | null>(null);
  const rectRef = useRef<CropRect | null>(null);
  const raf = useRef<number | null>(null);
  const lastPt = useRef({ x: 0, y: 0 });
  const drag = useRef<{ mode: 'move' | 0 | 1 | 2 | 3; px: number; py: number; r: CropRect } | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const scale = nat.w > 0 && nat.h > 0 && box.w > 0 ? Math.min(box.w / nat.w, box.h / nat.h) : 0;
  const dispW = nat.w * scale;
  const dispH = nat.h * scale;
  const ox = (box.w - dispW) / 2;
  const oy = (box.h - dispH) / 2;
  const imgAspect = nat.h > 0 ? nat.w / nat.h : 1;
  // Largest frame-shaped rect = the cover fit = zoom 1.
  const fullW = dispH > 0 && dispW / dispH > aspect ? dispH * aspect : dispW;
  const minW = fullW / MAX_CROP_ZOOM;

  const defaultRect = (): CropRect => ({ x: (dispW - fullW) / 2, y: (dispH - fullW / aspect) / 2, w: fullW, h: fullW / aspect });
  const set = (r: CropRect) => {
    rectRef.current = r;
    setRect(r);
  };

  // Initialise once the photo geometry is known (and when the frame shape changes).
  useEffect(() => {
    if (!scale || !dispW || !dispH) return;
    if (isCropV2(value)) {
      const f = cropToRect(value, imgAspect, aspect);
      set({ x: f.u * dispW, y: f.v * dispH, w: f.uw * dispW, h: f.vh * dispH });
    } else {
      set(defaultRect());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, dispW, dispH, aspect]);

  const emit = (r: CropRect) =>
    onChange(rectToCrop({ u: r.x / dispW, v: r.y / dispH, uw: r.w / dispW, vh: r.h / dispH }, imgAspect, aspect));

  /** Frame-shaped rect of width w centred on (cx, cy), kept inside the photo. */
  const fit = (w: number, cx: number, cy: number): CropRect => {
    const ww = Math.min(fullW, Math.max(minW, w));
    const hh = ww / aspect;
    return { x: Math.min(dispW - ww, Math.max(0, cx - ww / 2)), y: Math.min(dispH - hh, Math.max(0, cy - hh / 2)), w: ww, h: hh };
  };

  const computeRect = (mode: 'move' | 0 | 1 | 2 | 3, dx: number, dy: number, s: CropRect): CropRect => {
    if (mode === 'move') {
      return { ...s, x: Math.min(dispW - s.w, Math.max(0, s.x + dx)), y: Math.min(dispH - s.h, Math.max(0, s.y + dy)) };
    }
    // Corners: 0 TL, 1 TR, 2 BL, 3 BR. The opposite corner is the anchor; the
    // size follows where the dragged corner now is, relative to that anchor.
    const right = mode === 1 || mode === 3;
    const bottom = mode === 2 || mode === 3;
    const ax = right ? s.x : s.x + s.w;
    const ay = bottom ? s.y : s.y + s.h;
    const cx = (right ? s.x + s.w : s.x) + dx;
    const cy = (bottom ? s.y + s.h : s.y) + dy;
    const reachX = right ? cx - ax : ax - cx;
    const reachY = bottom ? cy - ay : ay - cy;
    // Room left inside the photo on the growing side.
    const roomX = right ? dispW - ax : ax;
    const roomY = bottom ? dispH - ay : ay;
    let w = Math.max(reachX, reachY * aspect);
    w = Math.max(minW, Math.min(w, roomX, roomY * aspect, fullW));
    const h = w / aspect;
    return { x: right ? ax : ax - w, y: bottom ? ay : ay - h, w, h };
  };

  const onDown = (mode: 'move' | 0 | 1 | 2 | 3) => (e: React.PointerEvent) => {
    if (!rectRef.current) return;
    e.stopPropagation();
    stageRef.current?.setPointerCapture(e.pointerId);
    lastPt.current = { x: e.clientX, y: e.clientY };
    drag.current = { mode, px: e.clientX, py: e.clientY, r: rectRef.current };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    // One state update per frame, pointermove outruns React's paints.
    lastPt.current = { x: e.clientX, y: e.clientY };
    if (raf.current != null) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const d = drag.current;
      if (!d) return;
      set(computeRect(d.mode, lastPt.current.x - d.px, lastPt.current.y - d.py, d.r));
    });
  };
  const onUp = () => {
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    const d = drag.current;
    drag.current = null;
    if (d) {
      const next = computeRect(d.mode, lastPt.current.x - d.px, lastPt.current.y - d.py, d.r);
      set(next);
      emit(next);
    }
  };

  const zoom = rect && rect.w > 0 && fullW > 0 ? fullW / rect.w : 1;
  const zoomTo = (z: number) => {
    const r = rectRef.current;
    if (!r) return;
    set(fit(fullW / Math.min(MAX_CROP_ZOOM, Math.max(1, z)), r.x + r.w / 2, r.y + r.h / 2));
  };
  // Wheel zoom (non-passive so the page doesn't scroll under the cursor).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let t: number | undefined;
    const onWheel = (e: WheelEvent) => {
      const r = rectRef.current;
      if (!r || !fullW) return;
      e.preventDefault();
      const z = fullW / r.w;
      const next = fit(fullW / Math.min(MAX_CROP_ZOOM, Math.max(1, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))), r.x + r.w / 2, r.y + r.h / 2);
      set(next);
      window.clearTimeout(t);
      t = window.setTimeout(() => emit(next), 180);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.clearTimeout(t);
    };
  });

  const handles: { i: 0 | 1 | 2 | 3; x: 'left' | 'right'; y: 'top' | 'bottom'; cursor: string }[] = [
    { i: 0, x: 'left', y: 'top', cursor: 'nwse-resize' },
    { i: 1, x: 'right', y: 'top', cursor: 'nesw-resize' },
    { i: 2, x: 'left', y: 'bottom', cursor: 'nesw-resize' },
    { i: 3, x: 'right', y: 'bottom', cursor: 'nwse-resize' },
  ];

  return (
    <div className="space-y-2">
      <div
        ref={stageRef}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative h-64 w-full touch-none select-none overflow-hidden rounded-xl bg-[#141210]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={uri}
          alt=""
          draggable={false}
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="pointer-events-none absolute"
          style={{ left: ox, top: oy, width: dispW || undefined, height: dispH || undefined, maxWidth: 'none' }}
        />
        {rect ? (
          <>
            {/* dim outside the rect (4 slabs, a huge box-shadow repaints the
                whole stage every frame and makes the drag stutter) */}
            <div className="pointer-events-none absolute left-0 top-0 w-full" style={{ height: Math.max(0, oy + rect.y), backgroundColor: 'rgba(0,0,0,0.55)' }} />
            <div className="pointer-events-none absolute left-0 w-full" style={{ top: oy + rect.y + rect.h, height: Math.max(0, box.h - (oy + rect.y + rect.h)), backgroundColor: 'rgba(0,0,0,0.55)' }} />
            <div className="pointer-events-none absolute left-0" style={{ top: oy + rect.y, width: Math.max(0, ox + rect.x), height: rect.h, backgroundColor: 'rgba(0,0,0,0.55)' }} />
            <div className="pointer-events-none absolute" style={{ left: ox + rect.x + rect.w, top: oy + rect.y, width: Math.max(0, box.w - (ox + rect.x + rect.w)), height: rect.h, backgroundColor: 'rgba(0,0,0,0.55)' }} />
            <div onPointerDown={onDown('move')} className="absolute cursor-move" style={{ left: ox + rect.x, top: oy + rect.y, width: rect.w, height: rect.h }}>
              <span className="pointer-events-none absolute left-1/3 top-0 h-full w-px bg-white/35" />
              <span className="pointer-events-none absolute left-2/3 top-0 h-full w-px bg-white/35" />
              <span className="pointer-events-none absolute left-0 top-1/3 h-px w-full bg-white/35" />
              <span className="pointer-events-none absolute left-0 top-2/3 h-px w-full bg-white/35" />
              <span className="pointer-events-none absolute inset-0 border border-white/80" />
            </div>
            {handles.map((h) => (
              <span
                key={h.i}
                onPointerDown={onDown(h.i)}
                className="absolute h-5 w-5 rounded-[5px] border-2 border-[#141210] bg-white"
                style={{ cursor: h.cursor, left: ox + rect.x + (h.x === 'left' ? 0 : rect.w) - 10, top: oy + rect.y + (h.y === 'top' ? 0 : rect.h) - 10 }}
              />
            ))}
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-muted">Zoom</span>
        <input
          type="range"
          min={1}
          max={MAX_CROP_ZOOM}
          step={0.01}
          value={Math.round(zoom * 100) / 100}
          onChange={(e) => zoomTo(Number(e.target.value))}
          onPointerUp={() => rectRef.current && emit(rectRef.current)}
          onKeyUp={() => rectRef.current && emit(rectRef.current)}
          aria-label="Crop zoom"
          className="min-w-0 flex-1 accent-[#4D7CFE]"
        />
        <span className="w-10 text-right text-xs font-bold tabular-nums">{zoom.toFixed(1)}×</span>
      </div>
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs text-muted">Drag inside to move, drag a corner to resize, scroll to zoom.</p>
        <button
          type="button"
          onClick={() => {
            if (dispW) set(defaultRect());
            onReset();
          }}
          className="btn btn-ghost"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- 04 content ------------------------------- */

export function ContentStep({
  page,
  patchPage,
  designH,
  openId,
  setOpenId,
}: Pick<StepApi, 'page' | 'patchPage'> & { designH: number; openId: string | null; setOpenId: (id: string | null) => void }) {
  // Selecting on the canvas opens the block here, bring it into view.
  useEffect(() => {
    if (!openId) return;
    // Next frame: on a tab switch the panel has only just mounted.
    const raf = requestAnimationFrame(() =>
      document.getElementById(`studio-block-${openId}`)?.scrollIntoView({ block: 'nearest' }),
    );
    return () => cancelAnimationFrame(raf);
  }, [openId]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Tallest the fixed card may be while the title + profile/socials rows
  // still fit, the stepper stops here so raising px can never shove them
  // off the canvas.
  const cardMaxH = Math.max(120, Math.min(640, Math.floor(maxCardHeightDesign(page, designH))));
  const blocks = page.blocks;
  const wmOn = page.showWatermark ?? true;

  const update = (id: string, patch: Partial<ContentBlock>) =>
    patchPage({ blocks: blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const patchStyle = (b: ContentBlock, patch: Partial<NonNullable<ContentBlock['style']>>) =>
    update(b.id, { style: { ...(b.style ?? {}), ...patch } });
  const remove = (id: string) => patchPage({ blocks: removeBlock(blocks, id) });
  const duplicate = (id: string) => {
    const res = duplicateBlock(blocks, id);
    patchPage({ blocks: res.blocks });
    if (res.id) setOpenId(res.id);
  };
  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    // Beside flags stay with the slots, so the row shapes hold.
    const next = [...blocks];
    const a = next[i];
    const c = next[j];
    next[i] = { ...c, style: { ...(c.style ?? {}), beside: a.style?.beside } };
    next[j] = { ...a, style: { ...(a.style ?? {}), beside: c.style?.beside } };
    patchPage({ blocks: next });
  };
  const add = (t: BlockType) => {
    const b = newBlock(t);
    patchPage({ blocks: [...blocks, b] });
    setOpenId(b.id);
  };
  const pickBlockImage = async (id: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        update(id, { imageUri: await fileToDataUrl(f) });
      } catch {
        /* unreadable, stay put */
      }
    };
    input.click();
  };
  const pickChartRowImage = async (b: ContentBlock, row: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const img = await fileToDataUrl(f);
        update(b.id, { chart: (b.chart ?? []).map((c, k) => (k === row ? { ...c, img } : c)) });
      } catch {
        /* unreadable, stay put */
      }
    };
    input.click();
  };

  const draftKey = (b: ContentBlock, kind: 'table' | 'chart') => `${b.id}:${kind}`;
  const draftFor = (b: ContentBlock, kind: 'table' | 'chart'): string => {
    const hit = drafts[draftKey(b, kind)];
    if (hit !== undefined) return hit;
    if (kind === 'table') return (b.table ?? []).map((r) => r.join(', ')).join('\n');
    return (b.chart ?? []).map((c) => `${c.label}, ${c.value}`).join('\n');
  };
  const commitDraft = (b: ContentBlock, kind: 'table' | 'chart') => {
    const raw = drafts[draftKey(b, kind)];
    if (raw === undefined) return;
    if (kind === 'table') {
      update(b.id, { table: raw.split('\n').map((r) => r.split(',').map((c) => c.trim())) });
    } else {
      const prev = b.chart ?? [];
      update(b.id, {
        chart: raw.split('\n').filter(Boolean).map((line, idx) => {
          const parsed = parseChartLine(line);
          return { ...parsed, color: prev[idx]?.color };
        }),
      });
    }
  };

  const commonInk =
    blocks.length > 0 && blocks.every((b) => (b.textColor ?? '#111111') === (blocks[0].textColor ?? '#111111'))
      ? (blocks[0].textColor ?? '#111111')
      : undefined;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="font-display text-[11px] font-extrabold tracking-[0.14em] text-ink">
          01 · <span className="text-sm tracking-normal text-ink">Card style</span>
        </p>
        <p className="-mt-2 text-xs text-muted">The inner card dressed as a social post.</p>
        <div className="flex flex-wrap gap-1.5">
          {CARD_STYLES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => patchPage({ cardStyle: c.id })}
              className={`min-w-[30%] flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                (page.cardStyle ?? 'minimal') === c.id ? 'bg-ink text-white dark:bg-white dark:text-black' : 'bg-card text-muted hover:bg-paper'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Field label="Card color">
          <Swatches colors={PALETTE} value={page.cardColor ?? '#FFFFFF'} onChange={(c) => patchPage({ cardColor: c })} />
        </Field>
        <SwitchRow title="Full card" sub="Content card fills the whole canvas. Single card" on={page.fullCard ?? false} onPress={() => patchPage({ fullCard: !(page.fullCard ?? false) })} />
        {page.fullCard ? (
          <>
            <SwitchRow title="Title inside card" sub="Card renders the title row itself" on={page.fullCardTitle ?? false} onPress={() => patchPage({ fullCardTitle: !(page.fullCardTitle ?? false) })} />
            <SwitchRow title="Avatar header" sub="Name + avatar at the top of the card" on={page.fullCardAvatar ?? false} onPress={() => patchPage({ fullCardAvatar: !(page.fullCardAvatar ?? false) })} />
            <SwitchRow title="Socials footer" sub="Handles row at the bottom of the card" on={page.fullCardSocials ?? false} onPress={() => patchPage({ fullCardSocials: !(page.fullCardSocials ?? false) })} />
          </>
        ) : null}
        {!page.fullCard ? (
          <>
            <Field label="Inner card height" hint="The social card (Minimal, Instagram, X…). Auto hugs your content, Fixed sets an exact height.">
              <Seg
                options={[{ value: 'auto', label: 'Auto' }, { value: 'fixed', label: 'Fixed' }]}
                value={page.cardH ? 'fixed' : 'auto'}
                onChange={(v) => patchPage({ cardH: v === 'fixed' ? Math.min(page.cardH ?? 300, cardMaxH) : null, cardY: v === 'fixed' ? (normCardY(page.cardY) ?? 'top') : page.cardY })}
              />
            </Field>
            {page.cardH ? (
              <>
                <Stepper value={Math.min(page.cardH, cardMaxH)} onChange={(v) => patchPage({ cardH: v })} step={20} min={120} max={cardMaxH} format={(v) => `${v}px`} />
                <Field label="Card position" hint="Where the fixed-height card sits.">
                  <Seg
                    options={[{ value: 'top', label: 'Top' }, { value: 'middle', label: 'Middle' }, { value: 'bottom', label: 'Bottom' }]}
                    value={normCardY(page.cardY) ?? 'top'}
                    onChange={(v) => patchPage({ cardY: v as 'top' | 'middle' | 'bottom' })}
                  />
                </Field>
              </>
            ) : null}
            <SwitchRow title="Stick photo to card" sub="Photo + badges follow the card position" on={page.stickToCard ?? false} onPress={() => patchPage({ stickToCard: !(page.stickToCard ?? false) })} />
          </>
        ) : null}
        <SwitchRow title="Verified check" sub="Blue tick after the handle" on={page.verified ?? true} onPress={() => patchPage({ verified: !(page.verified ?? true) })} />
        <SwitchRow title="Watermark" sub="Made with Sosial badge in the card" on={wmOn} onPress={() => patchPage({ showWatermark: !wmOn })} />
      </div>

      <div className="space-y-3">
        <p className="font-display text-[11px] font-extrabold tracking-[0.14em] text-ink">
          02 · <span className="text-sm tracking-normal text-ink">Blocks</span>
        </p>
        <p className="-mt-2 text-xs text-muted">Stack content inside the card, or click a block on the canvas to drag, resize and place it side by side.</p>
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_TYPES.filter((t) => t.id !== 'image' || !blocks.some((b) => b.type === 'image')).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => add(t.id)}
              className="rounded-full bg-card px-3.5 py-2.5 text-xs font-bold transition hover:bg-paper"
            >
              + {t.label}
            </button>
          ))}
        </div>

        {blocks.map((b, idx) => {
          const open = openId === b.id;
          return (
            <div key={b.id} id={`studio-block-${b.id}`} className={`card scroll-mt-2 p-3.5 ${open ? 'ring-2 ring-[#4D7CFE]' : ''}`}>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setOpenId(open ? null : b.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-bold capitalize">
                    {idx + 1} · {b.type === 'bar' || b.type === 'pie' || b.type === 'vbar' ? 'chart' : b.type}
                  </p>
                  <p className="truncate text-xs text-muted">{b.heading || 'No heading'}</p>
                </button>
                <button type="button" aria-label="Duplicate block" title="Duplicate" onClick={() => duplicate(b.id)} className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-paper text-sm font-bold">⧉</button>
                <button type="button" aria-label="Move up" onClick={() => move(b.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-paper text-sm font-bold">↑</button>
                <button type="button" aria-label="Move down" onClick={() => move(b.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-paper text-sm font-bold">↓</button>
                <button type="button" aria-label="Delete block" onClick={() => remove(b.id)} className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#FDEBEC] text-sm font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">✕</button>
              </div>
              {open ? (
                <div className="mt-3 space-y-2.5">
                  {(b.type === 'bar' || b.type === 'pie' || b.type === 'vbar') ? (
                    <Seg
                      options={[{ value: 'bar', label: 'Bars' }, { value: 'vbar', label: 'Columns' }, { value: 'pie', label: 'Pie' }]}
                      value={b.type}
                      onChange={(v) => update(b.id, { type: v as BlockType })}
                    />
                  ) : null}
                  <EmojiInput
                    value={b.heading ?? ''}
                    onChange={(v) => update(b.id, { heading: v })}
                    placeholder="Heading (optional)"
                    className="field"
                  />
                  {idx > 0 ? (
                    <Field label="Layout" hint="Beside puts it in the same row as the block above.">
                      <Seg
                        options={[{ value: 'row', label: 'Own row' }, { value: 'beside', label: 'Beside previous' }]}
                        value={b.style?.beside ? 'beside' : 'row'}
                        onChange={(v) => patchStyle(b, { beside: v === 'beside', width: undefined })}
                      />
                    </Field>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Field label="Width" hint="">
                      <Seg
                        options={[
                          { value: 'auto', label: 'Auto' },
                          { value: '1', label: 'Full' },
                          { value: '0.75', label: '¾' },
                          { value: String(2 / 3), label: '⅔' },
                          { value: '0.5', label: '½' },
                          { value: String(1 / 3), label: '⅓' },
                          { value: '0.25', label: '¼' },
                        ]}
                        value={b.style?.width == null ? 'auto' : String(b.style.width)}
                        onChange={(v) => patchStyle(b, { width: v === 'auto' ? undefined : Number(v) })}
                      />
                    </Field>
                    <Field label="Align" hint="">
                      <Seg
                        options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Mid' }, { value: 'right', label: 'Right' }]}
                        value={b.style?.align ?? 'left'}
                        onChange={(v) => patchStyle(b, { align: v as 'left' | 'center' | 'right' })}
                      />
                    </Field>
                  </div>
                  {b.type !== 'image' ? (
                    <Field label="Size" hint="Scales this block only. Or drag its corner handle on the canvas.">
                      <Stepper
                        value={b.style?.scale ?? 1}
                        onChange={(v) => patchStyle(b, { scale: Math.round(v * 100) / 100 })}
                        step={0.1}
                        min={0.5}
                        max={2.5}
                        format={(v) => `${Math.round(v * 100)}%`}
                      />
                    </Field>
                  ) : null}
                  <Field label="Box" hint="A padded, rounded fill behind the block.">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => patchStyle(b, { boxBg: undefined })}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${!b.style?.boxBg ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black' : 'border-line bg-card text-muted'}`}
                      >
                        None
                      </button>
                      <div className="min-w-0 flex-1">
                        <Swatches colors={PALETTE} value={b.style?.boxBg ?? ''} onChange={(c) => patchStyle(b, { boxBg: c })} />
                      </div>
                    </div>
                  </Field>
                  {/* Row spacing comes from the row's first block. */}
                  {!(idx > 0 && b.style?.beside) ? (
                    <Field label="Space above">
                      <Stepper
                        value={b.style?.spaceAbove ?? 0}
                        onChange={(v) => patchStyle(b, { spaceAbove: v || undefined })}
                        step={4}
                        min={0}
                        max={60}
                        format={(v) => `${v}px`}
                      />
                    </Field>
                  ) : null}
                  {b.type !== 'image' ? (
                    <Field label="Ink">
                      <Swatches colors={PALETTE} value={b.textColor ?? '#111111'} onChange={(c) => update(b.id, { textColor: c })} />
                    </Field>
                  ) : null}
                  {(b.type === 'bullets' || b.type === 'numbered' || b.type === 'free') ? (
                    <>
                      {(b.items ?? []).map((line, li) => (
                        <div key={li} className="flex items-center gap-1.5">
                          <input
                            value={line}
                            onChange={(e) => {
                              const items = [...(b.items ?? [])];
                              items[li] = e.target.value;
                              update(b.id, { items });
                            }}
                            className="field min-w-0 flex-1"
                            aria-label={`Line ${li + 1}`}
                          />
                          <button
                            type="button"
                            aria-label={`Remove line ${li + 1}`}
                            onClick={() => update(b.id, { items: (b.items ?? []).filter((_, k) => k !== li) })}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#FDEBEC] text-sm font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => update(b.id, { items: [...(b.items ?? []), 'New line'] })} className="btn btn-ghost w-full">
                        Add line
                      </button>
                    </>
                  ) : null}
                  {b.type === 'table' ? (
                    <>
                      <p className="text-xs text-muted">One row per line, commas separate columns.</p>
                      <EmojiTextarea
                        value={draftFor(b, 'table')}
                        onChange={(v) => setDrafts((d) => ({ ...d, [`${b.id}:table`]: v }))}
                        onBlur={() => commitDraft(b, 'table')}
                        rows={4}
                        className="field min-h-[90px] resize-y font-mono !text-xs"
                      />
                      <Field label="Column widths">
                        <Seg
                          options={[{ value: 'equal', label: 'Equal' }, { value: 'first', label: 'Wide first' }, { value: 'last', label: 'Wide last' }]}
                          value={
                            b.style?.tableColWidths
                              ? b.style.tableColWidths[0] > 1
                                ? 'first'
                                : 'last'
                              : 'equal'
                          }
                          onChange={(v) =>
                            patchStyle(b, {
                              tableColWidths:
                                v === 'equal' ? undefined : (b.table?.[0] ?? []).map((_, ci, arr) => (v === 'first' ? (ci === 0 ? 1.8 : 1) : ci === arr.length - 1 ? 1.8 : 1)),
                            })
                          }
                        />
                      </Field>
                      <Field label="Text size">
                        <Stepper
                          value={b.style?.tableScale ?? 1}
                          onChange={(v) => patchStyle(b, { tableScale: v })}
                          step={0.1}
                          min={0.6}
                          max={1.6}
                          format={(v) => `${Math.round(v * 100)}%`}
                        />
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <SwitchRow
                          title="Header fill"
                          on={b.style?.tableHeaderBg ?? true}
                          onPress={() => patchStyle(b, { tableHeaderBg: !(b.style?.tableHeaderBg ?? true) })}
                        />
                        <SwitchRow
                          title="Zebra rows"
                          on={b.style?.tableZebra ?? false}
                          onPress={() => patchStyle(b, { tableZebra: !(b.style?.tableZebra ?? false) })}
                        />
                      </div>
                    </>
                  ) : null}
                  {(b.type === 'bar' || b.type === 'pie' || b.type === 'vbar') ? (
                    <>
                      <p className="text-xs text-muted">One per line, any format. The number is detected. Example: Jan $40</p>
                      <EmojiTextarea
                        value={draftFor(b, 'chart')}
                        onChange={(v) => setDrafts((d) => ({ ...d, [`${b.id}:chart`]: v }))}
                        onBlur={() => commitDraft(b, 'chart')}
                        rows={4}
                        className="field min-h-[90px] resize-y font-mono !text-xs"
                      />
                      {(b.chart ?? []).map((d, di) => (
                        <div key={di} className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Row ${di + 1} picture`}
                            onClick={() => pickChartRowImage(b, di)}
                            className="h-[22px] w-[22px] shrink-0 overflow-hidden rounded-md border border-black/10 bg-black/5"
                          >
                            {d.img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={d.img} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-[10px] leading-[20px] text-muted">+</span>
                            )}
                          </button>
                          <span className="h-[18px] w-[18px] shrink-0 rounded-full border border-black/10" style={{ backgroundColor: d.color ?? DATA[di % DATA.length] }} />
                          <span className="min-w-0 flex-1 truncate text-xs font-bold">{d.label}</span>
                          <span className="flex gap-1 overflow-x-auto py-0.5">
                            {[...DATA, '#111111'].map((c) => (
                              <button
                                key={c}
                                type="button"
                                aria-label={`Slice color ${c}`}
                                onClick={() => update(b.id, { chart: (b.chart ?? []).map((cc, k) => (k === di ? { ...cc, color: c } : cc)) })}
                                className="h-6 w-6 shrink-0 rounded-full border"
                                style={{
                                  backgroundColor: c,
                                  borderWidth: (d.color ?? DATA[di % DATA.length]).toLowerCase() === c.toLowerCase() ? 2 : 1,
                                  borderColor: (d.color ?? DATA[di % DATA.length]).toLowerCase() === c.toLowerCase() ? '#c8500f' : 'rgba(0,0,0,0.08)',
                                }}
                              />
                            ))}
                          </span>
                        </div>
                      ))}
                      {b.type === 'pie' ? (
                        <Field label="Legend">
                          <Seg
                            options={[{ value: 'right', label: 'Right' }, { value: 'bottom', label: 'Below' }, { value: 'none', label: 'None' }]}
                            value={b.style?.chartLegend ?? 'right'}
                            onChange={(v) => patchStyle(b, { chartLegend: v as 'right' | 'bottom' | 'none' })}
                          />
                        </Field>
                      ) : null}
                      {b.type !== 'pie' ? (
                        <Field label="Thickness">
                          <Stepper
                            value={b.style?.chartThickness ?? 1}
                            onChange={(v) => patchStyle(b, { chartThickness: v })}
                            step={0.1}
                            min={0.3}
                            max={1.6}
                            format={(v) => `${Math.round(v * 100)}%`}
                          />
                        </Field>
                      ) : (
                        <Field label="Ring thickness">
                          <Stepper
                            value={b.style?.chartThickness ?? 0.35}
                            onChange={(v) => patchStyle(b, { chartThickness: v })}
                            step={0.05}
                            min={0.15}
                            max={0.8}
                            format={(v) => `${Math.round(v * 100)}%`}
                          />
                        </Field>
                      )}
                      <Field label="Corner rounding" hint="0 = style default">
                        <Stepper
                          value={b.style?.chartRadius ?? 0}
                          onChange={(v) => patchStyle(b, { chartRadius: v })}
                          step={0.1}
                          min={0}
                          max={1}
                          format={(v) => `${Math.round(v * 100)}%`}
                        />
                      </Field>
                      {b.type === 'vbar' ? (
                        <Field label="Column height">
                          <Stepper
                            value={b.style?.chartHeight ?? 1}
                            onChange={(v) => patchStyle(b, { chartHeight: v })}
                            step={0.1}
                            min={0.4}
                            max={1.6}
                            format={(v) => `${Math.round(v * 100)}%`}
                          />
                        </Field>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <SwitchRow
                          title="Values"
                          on={b.style?.chartShowValues ?? true}
                          onPress={() => patchStyle(b, { chartShowValues: !(b.style?.chartShowValues ?? true) })}
                        />
                        <SwitchRow
                          title="Labels"
                          on={b.style?.chartShowLabels ?? true}
                          onPress={() => patchStyle(b, { chartShowLabels: !(b.style?.chartShowLabels ?? true) })}
                        />
                      </div>
                      {b.type !== 'pie' ? (
                        <>
                          <Field label="Values sit">
                            <Seg
                              options={[{ value: 'out', label: 'Above' }, { value: 'in', label: 'In bar' }]}
                              value={b.style?.chartValuePos ?? 'out'}
                              onChange={(v) => patchStyle(b, { chartValuePos: v as 'out' | 'in' })}
                            />
                          </Field>
                          <Field label="Labels sit">
                            <Seg
                              options={[{ value: 'out', label: 'Outside' }, { value: 'in', label: 'In bar' }]}
                              value={b.style?.chartLabelPos ?? 'out'}
                              onChange={(v) => patchStyle(b, { chartLabelPos: v as 'out' | 'in' })}
                            />
                          </Field>
                          <Field label="Bar picture" hint="Uses each row's photo, fill the bar or a small tile">
                            <Seg
                              options={[{ value: 'none', label: 'None' }, { value: 'fill', label: 'Fill' }, { value: 'tile', label: 'Tile' }]}
                              value={b.style?.chartBarImg ?? 'none'}
                              onChange={(v) => patchStyle(b, { chartBarImg: v as 'none' | 'fill' | 'tile' })}
                            />
                          </Field>
                          {(b.style?.chartBarImg ?? 'none') === 'tile' ? (
                            <Field label="Tile position">
                              <Seg
                                options={[{ value: 'top', label: 'Top' }, { value: 'middle', label: 'Middle' }, { value: 'bottom', label: 'Bottom' }]}
                                value={b.style?.chartBarImgPos ?? 'middle'}
                                onChange={(v) => patchStyle(b, { chartBarImgPos: v as 'top' | 'middle' | 'bottom' })}
                              />
                            </Field>
                          ) : null}
                          <Field label="Label picture" hint="Show each row's photo as a small thumb beside the label">
                            <Seg
                              options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
                              value={(b.style?.chartLabelImg ?? true) ? 'on' : 'off'}
                              onChange={(v) => patchStyle(b, { chartLabelImg: v === 'on' })}
                            />
                          </Field>
                          {(b.style?.chartLabelImg ?? true) ? (
                            <Field label="Photo size">
                              <Stepper
                                value={b.style?.chartLabelImgSize ?? 1}
                                onChange={(v) => patchStyle(b, { chartLabelImgSize: Math.round(v * 10) / 10 })}
                                step={0.1}
                                min={0.5}
                                max={2}
                                format={(v) => `${Math.round(v * 100)}%`}
                              />
                            </Field>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  ) : null}
                  {b.type === 'image' ? (
                    <>
                      {b.imageUri ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.imageUri} alt="" className="h-40 w-full rounded-xl object-cover" />
                      ) : null}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => pickBlockImage(b.id)} className="btn btn-primary flex-1">
                          {b.imageUri ? 'Change image' : 'Pick image'}
                        </button>
                        {b.imageUri ? (
                          <button type="button" onClick={() => remove(b.id)} className="btn btn-ghost">
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <Field label="Size" hint="Square 1:1, Wide 16:9, or your own height.">
                        <Seg
                          options={[{ value: 'square', label: 'Square' }, { value: 'wide', label: 'Wide' }, { value: 'custom', label: 'Custom' }]}
                          value={b.imageAspect ?? (b.imageH !== undefined ? 'custom' : 'wide')}
                          onChange={(v) => update(b.id, { imageAspect: v as 'square' | 'wide' | 'custom' })}
                        />
                      </Field>
                      {(b.imageAspect ?? (b.imageH !== undefined ? 'custom' : 'wide')) === 'custom' ? (
                        <Field label="Height" hint={`${b.imageH ?? 140}px`}>
                          <Stepper value={b.imageH ?? 140} onChange={(v) => update(b.id, { imageH: v })} step={10} min={60} max={300} format={(v) => `${v}`} />
                        </Field>
                      ) : null}
                      <Field label="Fit">
                        <Seg
                          options={[{ value: 'cover', label: 'Fill' }, { value: 'contain', label: 'Fit' }]}
                          value={b.style?.imageFit ?? 'cover'}
                          onChange={(v) => patchStyle(b, { imageFit: v as 'cover' | 'contain' })}
                        />
                      </Field>
                      <Field label="Corners">
                        <Stepper
                          value={b.style?.imageRadius ?? 0}
                          onChange={(v) => patchStyle(b, { imageRadius: v })}
                          step={0.05}
                          min={0}
                          max={0.5}
                          format={(v) => `${Math.round(v * 200)}%`}
                        />
                      </Field>
                      {b.imageUri ? (
                        <Field label="Free crop" hint="Corner handles resize, drag inside to move.">
                          <CropEditor
                            key={b.imageUri}
                            uri={b.imageUri}
                            aspect={frameAspectOf(b, blocks)}
                            value={b.imageCrop}
                            onChange={(c) => update(b.id, { imageCrop: c })}
                            onReset={() => update(b.id, { imageCrop: undefined })}
                          />
                        </Field>
                      ) : null}
                      {b.imageUri ? (
                        <Field label="Focus" hint="Which third of the photo shows.">
                          <div className="space-y-1">
                            {[0, 1, 2].map((ry) => (
                              <div key={ry} className="flex gap-1">
                                {[0, 1, 2].map((rx) => {
                                  const f = ry * 3 + rx;
                                  const on = (b.imageFocus ?? 4) === f;
                                  return (
                                    <button
                                      key={f}
                                      type="button"
                                      onClick={() => update(b.id, { imageFocus: f })}
                                      aria-label={`Focus ${f + 1} of 9`}
                                      className={`h-10 w-10 rounded-lg border transition ${on ? 'border-accent bg-accent' : 'border-line bg-card'}`}
                                    />
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </Field>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {blocks.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm font-bold">Empty card</p>
            <p className="mt-1 text-xs text-muted">Add a block above to fill it.</p>
          </div>
        ) : null}
        {/* Global text styling rides under the blocks whose text it dresses. */}
        {blocks.length > 0 ? (
          <Field label="Content ink">
            <Swatches colors={PALETTE} value={commonInk} onChange={(c) => patchPage({ blocks: blocks.map((b) => ({ ...b, textColor: c })) })} />
          </Field>
        ) : null}
        <Field label="Content size" hint={`${Math.round((page.contentScale ?? 1) * 100)}%`}>
          <Stepper value={page.contentScale ?? 1} onChange={(v) => patchPage({ contentScale: v })} step={0.05} min={0.5} max={1.5} format={(v) => `${Math.round(v * 100)}%`} />
        </Field>
      </div>
    </div>
  );
}

/* -------------------------------- 05 pages --------------------------------- */

export function PagesStep({
  project,
  pageIndex,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
  onSize,
}: {
  project: StudioProject;
  pageIndex: number;
  onSelect: (i: number) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onSize: (s: PostSizeId) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="font-display text-[11px] font-extrabold tracking-[0.14em] text-ink">
          01 · <span className="text-sm tracking-normal text-ink">Size</span>
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {POST_SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSize(s.id)}
              className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition ${
                project.sizeId === s.id ? 'border-accent bg-accent-soft' : 'border-line bg-card hover:bg-paper'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{s.label}</span>
                <span className="block truncate text-xs text-muted">{s.hint}</span>
              </span>
              {project.sizeId === s.id ? <span aria-hidden="true" className="text-ink">✓</span> : null}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <p className="font-display text-[11px] font-extrabold tracking-[0.14em] text-ink">
          02 · <span className="text-sm tracking-normal text-ink">Pages</span>
        </p>
        <button type="button" onClick={onAdd} className="btn btn-ghost w-full">
          + Add page
        </button>
        <div className="space-y-1.5">
          {project.pages.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2.5 transition ${
                i === pageIndex ? 'border-accent bg-accent-soft' : 'border-line bg-card'
              }`}
            >
              <button type="button" onClick={() => onSelect(i)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-bold">
                  {i + 1} · {p.title.text.trim() || 'Untitled page'}
                </span>
              </button>
              <button type="button" aria-label="Move up" onClick={() => onMove(-1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-paper text-xs font-bold">↑</button>
              <button type="button" aria-label="Move down" onClick={() => onMove(1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-paper text-xs font-bold">↓</button>
              <button type="button" onClick={onDuplicate} className="rounded-lg bg-paper px-2 py-1.5 text-xs font-bold">
                Duplicate
              </button>
              {project.pages.length > 1 ? (
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FDEBEC] text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]"
                  aria-label={`Delete page ${i + 1}`}
                >
                  ✕
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">Tip: open a page, then use its Duplicate button on the stage for a copy next to it.</p>
      </div>
    </div>
  );
}
