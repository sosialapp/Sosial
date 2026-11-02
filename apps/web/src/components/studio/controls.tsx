'use client';

import type { Placement } from '@/lib/studio/model';

/** Small editor controls mirroring mobile ui.tsx (Seg, Stepper, Swatches, toggles). */
export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
            o.value === value
              ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black'
              : 'border-line bg-card text-muted hover:bg-paper'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 100,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
}) {
  const btn =
    'flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card text-base font-bold text-soft transition hover:bg-paper disabled:opacity-40';
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} className={btn}>
        −
      </button>
      <span className="min-w-14 text-center text-sm font-bold tabular-nums">
        {format ? format(value) : value}
      </span>
      <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} className={btn}>
        +
      </button>
    </div>
  );
}

export function Swatches({
  colors,
  value,
  onChange,
}: {
  colors: string[];
  value?: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={`Color ${c}`}
          aria-pressed={value?.toLowerCase() === c.toLowerCase()}
          onClick={() => onChange(c)}
          className={`h-8 w-8 rounded-full border transition ${
            value?.toLowerCase() === c.toLowerCase()
              ? 'scale-110 border-accent ring-2 ring-accent'
              : 'border-black/10 hover:scale-105'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

export function Toggle({ on, onPress, label }: { on: boolean; onPress: () => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onPress}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-accent' : 'bg-surface'}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  );
}

export function SwitchRow({
  title,
  sub,
  on,
  onPress,
}: {
  title: string;
  sub?: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
      </div>
      <Toggle on={on} onPress={onPress} label={title} />
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-muted">
        {label}
        {hint ? <span className="ml-1.5 font-medium text-faint">{hint}</span> : null}
      </p>
      {children}
    </div>
  );
}

/** Rotation, opacity, layer order and reset for one placeable element (a
 *  block, the title or the profile row). Moving happens on the canvas.
 *  Mobile PlacementControls (src/components/ui.tsx) mirrors this. */
export function PlacementControls({
  value,
  onChange,
  onLayer,
  hint,
}: {
  value: Placement;
  onChange: (patch: Placement) => void;
  onLayer: (where: 'front' | 'back') => void;
  hint?: string;
}) {
  const rot = value.rotate ?? 0;
  const opa = Math.round((value.opacity ?? 1) * 100);
  const placed = !!(value.dx || value.dy || value.rotate);
  const pill = 'rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-bold text-muted transition hover:bg-paper';
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rotation">
          <Stepper value={rot} onChange={(v) => onChange({ rotate: v || undefined })} step={5} min={-180} max={180} format={(v) => `${v}°`} />
        </Field>
        <Field label="Opacity">
          <Stepper value={opa} onChange={(v) => onChange({ opacity: v >= 100 ? undefined : v / 100 })} step={10} min={10} max={100} format={(v) => `${v}%`} />
        </Field>
      </div>
      <Field label="Layer" hint={hint}>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => onLayer('front')} className={pill}>
            Bring to front
          </button>
          <button type="button" onClick={() => onLayer('back')} className={pill}>
            Send to back
          </button>
          {placed ? (
            <button type="button" onClick={() => onChange({ dx: undefined, dy: undefined, rotate: undefined })} className={pill}>
              Reset position
            </button>
          ) : null}
        </div>
      </Field>
    </div>
  );
}
