'use client';

import { useRef, useState } from 'react';
import {
  CARD_STYLES,
  DATA,
  PALETTE,
  POST_SIZES,
  newBlock,
  parseChartLine,
  type BlockType,
  type ContentBlock,
  type PostSizeId,
  type StudioProject,
} from '@/lib/studio/model';
import { EmojiInput, EmojiTextarea } from '@/components/Emoji';
import { Field, Seg, Stepper, Swatches, SwitchRow } from './controls';
import { fileToDataUrl } from './steps1';
import type { StepApi } from './steps1';

const BLOCK_TYPES: { id: BlockType; label: string }[] = [
  { id: 'bullets', label: 'Bullets' },
  { id: 'numbered', label: 'Numbers' },
  { id: 'table', label: 'Table' },
  { id: 'bar', label: 'Chart' },
  { id: 'vbar', label: 'Columns' },
  { id: 'free', label: 'Text' },
  { id: 'image', label: 'Image' },
];

const clampC = (v: number) => Math.min(1, Math.max(-1, v));

/** Drag-to-pan crop pad: the image renders with the same zoom/pan math as
 *  the canvas, dragging maps px deltas to the -1..1 pan range. */
function CropPad({
  uri, zoom, x, y, onChange,
}: {
  uri: string;
  zoom: number;
  x: number;
  y: number;
  onChange: (c: { zoom: number; x: number; y: number }) => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const z = Math.max(1, zoom);
  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x, y };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const box = boxRef.current;
    if (!d || !box || z <= 1) return;
    const dx = ((e.clientX - d.px) * 2) / (box.clientWidth * (z - 1));
    const dy = ((e.clientY - d.py) * 2) / (box.clientHeight * (z - 1));
    onChange({ zoom, x: clampC(d.x + dx), y: clampC(d.y + dy) });
  };
  const onUp = () => {
    drag.current = null;
  };
  return (
    <div
      ref={boxRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className="relative h-44 w-full touch-none select-none overflow-hidden rounded-xl bg-black/5"
      style={{ cursor: z > 1 ? 'grab' : 'default' }}
      aria-label="Crop preview — drag to reposition"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={uri}
        alt=""
        draggable={false}
        className="pointer-events-none absolute block"
        style={{
          width: `${z * 100}%`, height: `${z * 100}%`, objectFit: 'cover',
          left: `${(x - 1) * (z - 1) * 50}%`, top: `${(y - 1) * (z - 1) * 50}%`,
        }}
      />
    </div>
  );
}

/* -------------------------------- 04 content ------------------------------- */

export function ContentStep({ page, patchPage }: Pick<StepApi, 'page' | 'patchPage'>) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const blocks = page.blocks;
  const wmOn = page.showWatermark ?? true;

  const update = (id: string, patch: Partial<ContentBlock>) =>
    patchPage({ blocks: blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const patchStyle = (b: ContentBlock, patch: Partial<NonNullable<ContentBlock['style']>>) =>
    update(b.id, { style: { ...(b.style ?? {}), ...patch } });
  const remove = (id: string) => patchPage({ blocks: blocks.filter((b) => b.id !== id) });
  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
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
        /* unreadable — stay put */
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
            <Field label="Card height">
              <Seg
                options={[{ value: 'auto', label: 'Auto fill' }, { value: 'fixed', label: 'Fixed' }]}
                value={page.cardH ? 'fixed' : 'auto'}
                onChange={(v) => patchPage({ cardH: v === 'fixed' ? (page.cardH ?? 300) : null })}
              />
            </Field>
            {page.cardH ? (
              <>
                <Stepper value={page.cardH} onChange={(v) => patchPage({ cardH: v })} step={20} min={120} max={640} format={(v) => `${v}px`} />
                <Field label="Card position">
                  <Seg
                    options={[{ value: 'top', label: 'Top' }, { value: 'middle', label: 'Middle' }, { value: 'bottom', label: 'Bottom' }]}
                    value={page.cardY ?? 'bottom'}
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
        <p className="-mt-2 text-xs text-muted">Stack content inside the card.</p>
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
            <div key={b.id} className={`card p-3.5 ${open ? 'ring-1 ring-line' : ''}`}>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setOpenId(open ? null : b.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-bold capitalize">
                    {idx + 1} · {b.type === 'bar' || b.type === 'pie' || b.type === 'vbar' ? 'chart' : b.type}
                  </p>
                  <p className="truncate text-xs text-muted">{b.heading || 'No heading'}</p>
                </button>
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
                  <div className="flex gap-2">
                    <Field label="Width" hint="">
                      <Seg
                        options={[{ value: '1', label: 'Full' }, { value: '0.75', label: '75%' }, { value: '0.5', label: '50%' }]}
                        value={String(b.style?.width ?? 1)}
                        onChange={(v) => patchStyle(b, { width: Number(v) })}
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
                        <Field label="Free crop" hint="Drag the photo, zoom in, Done.">
                          <div className="space-y-2">
                            <CropPad
                              uri={b.imageUri}
                              zoom={b.imageCrop?.zoom ?? 1}
                              x={b.imageCrop?.x ?? 0}
                              y={b.imageCrop?.y ?? 0}
                              onChange={(c) => update(b.id, { imageCrop: c })}
                            />
                            <div className="flex items-center gap-2">
                              <Stepper
                                value={b.imageCrop?.zoom ?? 1}
                                onChange={(v) =>
                                  update(b.id, { imageCrop: { zoom: v, x: b.imageCrop?.x ?? 0, y: b.imageCrop?.y ?? 0 } })
                                }
                                step={0.1}
                                min={1}
                                max={3}
                                format={(v) => `${v.toFixed(1)}x`}
                              />
                              <span className="flex-1" />
                              {b.imageCrop ? (
                                <button type="button" onClick={() => update(b.id, { imageCrop: undefined })} className="btn btn-ghost">
                                  Reset crop
                                </button>
                              ) : null}
                            </div>
                          </div>
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
