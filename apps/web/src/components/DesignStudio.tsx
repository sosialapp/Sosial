'use client';

import { useState } from 'react';
import {
  CANVAS_BGS,
  CANVAS_SIZES,
  bgOf,
  sizeOf,
  type CanvasDesign,
} from '@/lib/canvasDesign';

/** Scaled HTML miniature — same ratios and copy flow as the PNG export. */
export function DesignPreview({ design }: { design: CanvasDesign }) {
  const bg = bgOf(design);
  const ratio = sizeOf(design).ratio;
  const ink = bg.ink ? '#191512' : '#ffffff';
  const sub = bg.ink ? 'rgba(25,21,18,0.72)' : 'rgba(255,255,255,0.82)';
  return (
    <div
      className="w-full overflow-hidden [container-type:inline-size]"
      style={{
        aspectRatio: `1 / ${ratio}`,
        borderRadius: 14,
        background: `linear-gradient(135deg, ${bg.from}, ${bg.to})`,
      }}
    >
      <div className="flex h-full flex-col p-[10cqw]">
        <div className="flex flex-1 flex-col justify-center">
          {design.title.trim() ? (
            <p className="font-display font-extrabold leading-[1.05]" style={{ fontSize: '8.6cqw', color: ink }}>
              {design.title.trim()}
            </p>
          ) : null}
          {design.body.trim() ? (
            <p className="mt-[3cqw] leading-snug" style={{ fontSize: '4.6cqw', color: sub }}>
              {design.body.trim()}
            </p>
          ) : null}
          {!design.title.trim() && !design.body.trim() ? (
            <p className="text-center" style={{ fontSize: '4.6cqw', color: sub }}>
              Your copy appears here
            </p>
          ) : null}
        </div>
        <p className="flex items-center gap-[2cqw]" style={{ fontSize: '4cqw', color: sub }}>
          <span
            aria-hidden="true"
            className="inline-block rounded-full"
            style={{
              width: '2.4cqw',
              height: '2.4cqw',
              background: bg.ink ? '#c8500f' : '#f5b98a',
            }}
          />
          {design.handle.trim() || '@yourhandle'}
        </p>
      </div>
    </div>
  );
}

const blankDraft = (): Omit<CanvasDesign, 'id' | 'createdAt'> => ({
  name: '',
  sizeId: 'portrait',
  bgId: 'ember',
  title: '',
  body: '',
  handle: '@yourhandle',
});

/**
 * The design editor (mobile opens it as its own screen; web toggles it under
 * the "+ New template design" CTA). Gallery lives in the Templates tab.
 */
export default function DesignStudio({
  onSave,
  onUse,
  busyId,
}: {
  onSave: (d: Omit<CanvasDesign, 'id' | 'createdAt'>) => void;
  onUse: (d: CanvasDesign) => void;
  busyId: string | null;
}) {
  const [draft, setDraft] = useState(blankDraft());
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));
  const preview: CanvasDesign = { ...draft, id: 'draft', name: draft.name || 'Untitled', createdAt: 0 };

  return (
    <div className="card grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-2">
      <div className="space-y-3">
        <p className="eyebrow">New design</p>
        <input
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Design name… e.g. Friday drop"
          className="field font-display font-bold"
          aria-label="Design name"
        />
        <div>
          <p className="mb-1.5 text-xs font-bold text-muted">Size</p>
          <div className="flex gap-1.5">
            {CANVAS_SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => set({ sizeId: s.id })}
                className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                  draft.sizeId === s.id
                    ? 'border-accent bg-accent text-white'
                    : 'border-line bg-paper text-soft hover:bg-bone'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-bold text-muted">Backdrop</p>
          <div className="flex flex-wrap gap-1.5">
            {CANVAS_BGS.map((b) => (
              <button
                key={b.id}
                type="button"
                title={b.name}
                aria-label={`${b.name} backdrop`}
                aria-pressed={draft.bgId === b.id}
                onClick={() => set({ bgId: b.id })}
                className={`h-9 w-9 rounded-full transition ${
                  draft.bgId === b.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : 'hover:scale-105'
                }`}
                style={{ background: `linear-gradient(135deg, ${b.from}, ${b.to})` }}
              />
            ))}
          </div>
        </div>
        <input
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Headline…"
          className="field font-display font-bold"
          aria-label="Design headline"
        />
        <textarea
          value={draft.body}
          onChange={(e) => set({ body: e.target.value })}
          placeholder="Supporting copy…"
          rows={3}
          className="field min-h-[84px] resize-y"
          aria-label="Design body"
        />
        <input
          value={draft.handle}
          onChange={(e) => set({ handle: e.target.value })}
          placeholder="@yourhandle"
          className="field"
          aria-label="Design handle"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (!draft.name.trim() || (!draft.title.trim() && !draft.body.trim())) return;
              onSave({ ...draft, name: draft.name.trim() });
              setDraft(blankDraft());
            }}
            className="btn btn-ghost"
          >
            Save design
          </button>
          <button type="button" onClick={() => onUse(preview)} disabled={busyId !== null} className="btn btn-primary">
            {busyId === 'draft' ? 'Rendering…' : 'Use design'}
          </button>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[300px] lg:max-w-[340px]">
        <DesignPreview design={preview} />
      </div>
    </div>
  );
}
