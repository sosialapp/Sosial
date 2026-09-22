'use client';

/** The five editor steps — ports of mobile BackgroundPicker, TitleEditor,
 *  PhotoSocialsEditor, ContentEditor (minus AI-generate, which needs the
 *  native AI backend) and the Pages panel. */

import { useState } from 'react';
import {
  ALL_SOCIALS,
  BG_PRESETS,
  CARD_STYLES,
  DATA,
  FONT_OPTIONS,
  PALETTE,
  POST_SIZES,
  newBlock,
  parseChartLine,
  uid,
  type BackgroundStyle,
  type BgType,
  type BlockType,
  type ContentBlock,
  type FontId,
  type PfpStyle,
  type PostPage,
  type PostSizeId,
  type PostTitle,
  type SocialPlatform,
  type StudioProject,
} from '@/lib/studio/model';
import { providerMeta } from '@/lib/providers';
import { BrandIcon } from '@/components/BrandIcon';
import { Field, Seg, Stepper, Swatches, SwitchRow, Toggle } from './controls';

export interface StepApi {
  page: PostPage;
  patchPage: (p: Partial<PostPage>) => void;
  patchBackground: (p: Partial<BackgroundStyle>) => void;
  patchTitle: (p: Partial<PostTitle>) => void;
  patchPfp: (p: Partial<PfpStyle>) => void;
}

function Section({ no, title, hint }: { no: string; title: string; hint?: string }) {
  return (
    <div>
      <p className="font-display text-[11px] font-extrabold tracking-[0.14em] text-accent">
        {no} · <span className="text-sm tracking-normal text-ink">{title}</span>
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function PatternGrid({ options, value, onChange }: { options: { value: BgType; label: string }[]; value: BgType; onChange: (v: BgType) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${
            o.value === value
              ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black'
              : 'border-line bg-card text-ink hover:bg-paper'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const BG_TYPES: { value: BgType; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dots', label: 'Dots' },
  { value: 'grid', label: 'Grid' },
  { value: 'stripes', label: 'Lines' },
  { value: 'zigzag', label: 'Zigzag' },
  { value: 'waves', label: 'Waves' },
  { value: 'hearts', label: 'Love' },
  { value: 'stars', label: 'Stars' },
  { value: 'crosses', label: 'Crosses' },
  { value: 'doodle', label: 'Doodle' },
  { value: 'image', label: 'Photo' },
];

const MIX_TYPES: { value: BgType; label: string }[] = [
  { value: 'dots', label: 'Dots' },
  { value: 'grid', label: 'Grid' },
  { value: 'stripes', label: 'Lines' },
  { value: 'zigzag', label: 'Zigzag' },
  { value: 'waves', label: 'Waves' },
  { value: 'hearts', label: 'Love' },
  { value: 'stars', label: 'Stars' },
  { value: 'crosses', label: 'Crosses' },
  { value: 'doodle', label: 'Doodle' },
];

/** Downscale uploads to data URLs so designs stay persistable. */
export function fileToDataUrl(file: File, maxDim = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable.');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}

function PhotoButton({ label, primary, onPick }: { label: string; primary?: boolean; onPick: (dataUrl: string) => void }) {
  return (
    <label className={`btn cursor-pointer ${primary ? 'btn-primary' : 'btn-ghost'}`}>
      {label}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            onPick(await fileToDataUrl(f));
          } catch {
            /* unreadable file — stay put */
          }
          e.target.value = '';
        }}
      />
    </label>
  );
}

/* ------------------------------- 01 background ------------------------------ */

export function BackgroundStep({ page, patchBackground }: Pick<StepApi, 'page' | 'patchBackground'>) {
  const bg = page.background;
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Section no="01" title="Pattern" hint="The texture behind everything." />
        <PatternGrid options={BG_TYPES} value={bg.type} onChange={(v) => patchBackground({ type: v })} />
        {bg.type === 'image' ? (
          <PhotoButton label={bg.imageUri ? 'Change photo' : 'Choose a photo'} primary onPick={(uri) => patchBackground({ type: 'image', imageUri: uri })} />
        ) : null}
      </div>
      <div className="space-y-3">
        <Section no="02" title="Colors" />
        <Field label="Base">
          <Swatches colors={PALETTE} value={bg.color} onChange={(c) => patchBackground({ color: c })} />
        </Field>
        <Field label="Pattern ink">
          <Swatches colors={PALETTE} value={bg.patternColor} onChange={(c) => patchBackground({ patternColor: c })} />
        </Field>
        <Field label="Pattern size" hint={`${bg.patternSize}px`}>
          <Stepper value={bg.patternSize} onChange={(v) => patchBackground({ patternSize: v })} step={4} min={10} max={56} format={(v) => `${v}px`} />
        </Field>
      </div>
      <div className="space-y-3">
        <Section no="03" title="Presets" hint="One-tap starting points." />
        <div className="card divide-y divide-line-soft overflow-hidden">
          {BG_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => patchBackground({ color: p.color, patternColor: p.patternColor })}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-bone dark:hover:bg-white/5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-black/10" style={{ backgroundColor: p.color }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.patternColor }} />
              </span>
              <span className="flex-1 text-sm font-bold">{p.label}</span>
              <span aria-hidden="true" className="text-faint">›</span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Section no="04" title="Blend" hint="Layer a second pattern on top." />
        <SwitchRow title="Second pattern" on={bg.mixEnabled} onPress={() => patchBackground({ mixEnabled: !bg.mixEnabled })} />
        {bg.mixEnabled ? (
          <div className="space-y-3">
            <PatternGrid options={MIX_TYPES} value={(bg.mixType ?? 'grid') as BgType} onChange={(v) => patchBackground({ mixType: v })} />
            <Swatches colors={PALETTE.slice(0, 8)} value={bg.mixColor} onChange={(c) => patchBackground({ mixColor: c })} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------- 02 title --------------------------------- */

export function TitleStep({ page, patchTitle, patchPage }: Pick<StepApi, 'page' | 'patchTitle' | 'patchPage'>) {
  const t = page.title;
  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <Section no="01" title="Headline" hint="The first thing people read." />
        <textarea
          value={t.text}
          onChange={(e) => patchTitle({ text: e.target.value })}
          placeholder="Type your headline…"
          rows={2}
          className="field min-h-[56px] resize-y font-display font-bold"
        />
        <Field label="Placement">
          <Seg
            options={[
              { value: 'top', label: 'Top' },
              { value: 'bottom', label: 'Bottom' },
              { value: 'none', label: 'Hidden' },
            ]}
            value={t.position}
            onChange={(v) => patchTitle({ position: v as 'top' | 'bottom' | 'none' })}
          />
        </Field>
        <Field label="Alignment">
          <Seg
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
            ]}
            value={t.align}
            onChange={(v) => patchTitle({ align: v as 'left' | 'center' | 'right' })}
          />
        </Field>
      </div>
      <div className="card space-y-3 p-4">
        <Section no="02" title="Subtitle" hint="A smaller line under the headline." />
        <textarea
          value={t.subtitle ?? ''}
          onChange={(e) => patchTitle({ subtitle: e.target.value })}
          placeholder="Smaller line under the headline…"
          rows={2}
          className="field min-h-[48px] resize-y"
        />
        <Field label="Subtitle size" hint={`${t.subtitleSize ?? 15}pt`}>
          <Stepper value={t.subtitleSize ?? 15} onChange={(v) => patchTitle({ subtitleSize: v })} step={1} min={8} max={32} format={(v) => `${v}pt`} />
        </Field>
        <Field label="Subtitle ink" hint="Follows the headline font">
          <Swatches colors={PALETTE} value={t.subtitleColor ?? t.color} onChange={(c) => patchTitle({ subtitleColor: c })} />
        </Field>
      </div>
      <div className="card space-y-3 p-4">
        <Section no="03" title="Type" hint="Font and weight for both lines." />
        <Field label="Font">
          <div className="flex flex-wrap gap-1.5">
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => patchTitle({ font: f.value })}
                className={`min-w-[30%] flex-1 rounded-xl px-3 py-2.5 text-xs transition ${
                  t.font === f.value ? 'bg-ink text-white dark:bg-white dark:text-black' : 'bg-paper text-muted hover:bg-bone'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Weight">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => patchTitle({ bold: !t.bold })}
              aria-pressed={t.bold}
              className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold transition ${t.bold ? 'bg-ink text-white dark:bg-white dark:text-black' : 'bg-paper text-muted'}`}
            >
              B
            </button>
            <button
              type="button"
              onClick={() => patchTitle({ italic: !t.italic })}
              aria-pressed={t.italic}
              className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg italic transition ${t.italic ? 'bg-ink text-white dark:bg-white dark:text-black' : 'bg-paper text-muted'}`}
            >
              I
            </button>
          </div>
        </Field>
        <Field label="Headline size" hint={`${t.size}pt`}>
          <Stepper value={t.size} onChange={(v) => patchTitle({ size: v })} step={2} min={16} max={52} format={(v) => `${v}pt`} />
        </Field>
      </div>
      <div className="card space-y-3 p-4">
        <Section no="04" title="Ink" hint="Headline color." />
        <Swatches colors={PALETTE} value={t.color} onChange={(c) => patchTitle({ color: c })} />
      </div>
      <div className="card space-y-3 p-4">
        <Section no="05" title="Caption" hint="Copied into the composer when you post." />
        <textarea
          value={page.caption ?? ''}
          onChange={(e) => patchPage({ caption: e.target.value })}
          placeholder="Description for Facebook / IG…"
          rows={3}
          className="field min-h-[72px] resize-y"
        />
      </div>
    </div>
  );
}

/* ----------------------------- 03 photo & socials ---------------------------- */

export function PhotoSocialsStep({ page, patchPfp, patchPage }: Pick<StepApi, 'page' | 'patchPfp' | 'patchPage'>) {
  const p = page.pfp;
  const setSocials = (s: typeof page.socials) => patchPage({ socials: s });
  const toggle = (platform: SocialPlatform) => {
    const existing = page.socials.find((s) => s.platform === platform);
    if (existing) {
      setSocials(page.socials.map((s) => (s.platform === platform ? { ...s, visible: !s.visible } : s)));
    } else {
      setSocials([...page.socials, { id: `s_${Date.now().toString(36)}`, platform, handle: '@yourhandle', visible: true, font: 'jakarta', bold: true, italic: false }]);
    }
  };
  const visibleSocials = page.socials.filter((s) => s.visible);
  return (
    <div className="space-y-4">
      <SwitchRow
        title="Show photo & socials"
        sub={(p.hidden ?? false) ? 'Hidden on the canvas' : 'Visible on the canvas'}
        on={!(p.hidden ?? false)}
        onPress={() => patchPfp({ hidden: !(p.hidden ?? false) })}
      />
      <div className="space-y-3" style={{ opacity: p.hidden ? 0.45 : 1 }}>
        <Section no="01" title="Portrait" hint="Your face on the post." />
        {p.uri ? (
          <div className="card flex items-center gap-3 p-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.uri} alt="" className="h-16 w-16 object-cover" style={{ borderRadius: p.shape === 'circle' ? 32 : 14 }} />
            <div className="flex flex-1 gap-2">
              <PhotoButton primary label="Change" onPick={(uri) => patchPfp({ uri })} />
              <button type="button" onClick={() => patchPfp({ uri: undefined })} className="btn btn-ghost flex-1">
                Remove
              </button>
            </div>
          </div>
        ) : (
          <PhotoButton primary label="Choose a profile picture" onPick={(uri) => patchPfp({ uri })} />
        )}
        <Field label="Position">
          <Seg options={[{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }]} value={p.pfpY} onChange={(v) => patchPfp({ pfpY: v as 'top' | 'bottom' })} />
        </Field>
        <Field label="Alignment">
          <Seg
            options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]}
            value={p.align}
            onChange={(v) => patchPfp({ align: v as 'left' | 'center' | 'right' })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Size" hint={`${p.size}px`}>
            <Stepper value={p.size} onChange={(v) => patchPfp({ size: v })} step={4} min={28} max={64} format={(v) => `${v}`} />
          </Field>
          <Field label="Border" hint={`${p.borderW}px`}>
            <Stepper value={p.borderW} onChange={(v) => patchPfp({ borderW: v })} step={1} min={0} max={6} format={(v) => `${v}`} />
          </Field>
        </div>
        <Field label="Shape">
          <Seg options={[{ value: 'circle', label: 'Circle' }, { value: 'rounded', label: 'Rounded' }]} value={p.shape} onChange={(v) => patchPfp({ shape: v as 'circle' | 'rounded' })} />
        </Field>
        <Field label="Username" hint="Universal name under your photo.">
          <input value={p.username ?? ''} onChange={(e) => patchPfp({ username: e.target.value })} placeholder="Your name" className="field" />
        </Field>
      </div>
      <div className="space-y-3" style={{ opacity: p.hidden ? 0.45 : 1 }}>
        <Section no="02" title="Badges" hint="Centered next to your photo on the export." />
        <div className="card divide-y divide-line-soft overflow-hidden">
          {ALL_SOCIALS.map((pl) => {
            const found = page.socials.find((s) => s.platform === pl);
            const on = !!found?.visible;
            return (
              <div key={pl} className={`flex items-center gap-3 px-3.5 py-2.5 ${on ? '' : 'opacity-55'}`}>
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ backgroundColor: providerMeta(pl).color }}>
                  {pl === 'whatsapp' ? (
                    <span className="text-[11px] font-extrabold text-white">WA</span>
                  ) : (
                    <BrandIcon provider={pl} mono className="h-4 w-4 text-white" />
                  )}
                </span>
                <span className="flex-1 text-sm font-bold">{providerMeta(pl).label}</span>
                <Toggle on={on} onPress={() => toggle(pl)} label={`${providerMeta(pl).label} badge`} />
              </div>
            );
          })}
        </div>
        {visibleSocials.map((s) => (
          <div key={s.id} className="card space-y-2.5 p-3.5">
            <p className="text-xs font-bold text-soft">{providerMeta(s.platform).label} handle</p>
            <input value={s.handle} onChange={(e) => setSocials(page.socials.map((x) => (x.platform === s.platform ? { ...x, handle: e.target.value } : x)))} placeholder="@yourhandle" className="field" />
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <p className="text-[10.5px] font-bold text-muted">Font</p>
                <div className="flex flex-wrap gap-1">
                  {FONT_OPTIONS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setSocials(page.socials.map((x) => (x.platform === s.platform ? { ...x, font: f.value } : x)))}
                      className={`rounded-lg px-2 py-1.5 text-[11px] transition ${s.font === f.value ? 'bg-ink text-white dark:bg-white dark:text-black' : 'bg-paper text-muted'}`}
                    >
                      {f.label.slice(0, 4)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10.5px] font-bold text-muted">Style</p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setSocials(page.socials.map((x) => (x.platform === s.platform ? { ...x, bold: !x.bold } : x)))}
                    className={`flex h-8 w-9 items-center justify-center rounded-lg text-sm font-bold transition ${s.bold ? 'bg-ink text-white dark:bg-white dark:text-black' : 'bg-paper text-muted'}`}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => setSocials(page.socials.map((x) => (x.platform === s.platform ? { ...x, italic: !x.italic } : x)))}
                    className={`flex h-8 w-9 items-center justify-center rounded-lg text-sm italic transition ${s.italic ? 'bg-ink text-white dark:bg-white dark:text-black' : 'bg-paper text-muted'}`}
                  >
                    I
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {visibleSocials.length > 0 ? (
          <div className="space-y-3">
            <Field label="Placement">
              <Seg
                options={[{ value: 'below', label: 'Below' }, { value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }]}
                value={p.socialPos ?? 'below'}
                onChange={(v) => patchPfp({ socialPos: v as 'below' | 'right' | 'left' })}
              />
            </Field>
            <SwitchRow title="Badge background" sub="Dark pill behind the icons" on={p.badgeBg ?? true} onPress={() => patchPfp({ badgeBg: !(p.badgeBg ?? true) })} />
            <Field label="Handle ink">
              <Swatches colors={[...PALETTE, '#333333', '#666666', '#999999', '#CCCCCC']} value={p.handleColor} onChange={(c) => patchPfp({ handleColor: c })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Handle size" hint={`${p.handleSize}px`}>
                <Stepper value={p.handleSize} onChange={(v) => patchPfp({ handleSize: v })} step={0.5} min={6} max={14} format={(v) => `${v}`} />
              </Field>
              <Field label="Icon size" hint={`${p.iconSize}px`}>
                <Stepper value={p.iconSize} onChange={(v) => patchPfp({ iconSize: v })} step={1} min={12} max={28} format={(v) => `${v}`} />
              </Field>
            </div>
            <Field label="Icon style">
              <Seg options={[{ value: 'filled', label: 'Filled' }, { value: 'outline', label: 'Outline' }]} value={p.iconOutline ? 'outline' : 'filled'} onChange={(v) => patchPfp({ iconOutline: v === 'outline' })} />
            </Field>
            <Field label="Layout">
              <Seg options={[{ value: '1', label: 'Single row' }, { value: '2', label: 'Double row' }]} value={String(p.badgeRows)} onChange={(v) => patchPfp({ badgeRows: Number(v) as 1 | 2 })} />
            </Field>
            <Field label="Badge spacing" hint={`${p.socialGap ?? 6}px`}>
              <Stepper value={p.socialGap ?? 6} onChange={(v) => patchPfp({ socialGap: v })} step={1} min={0} max={16} format={(v) => `${v}px`} />
            </Field>
          </div>
        ) : null}
      </div>
    </div>
  );
}
