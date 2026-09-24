'use client';

import { useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { generateImage, PICTURE_RATIOS, type PictureRatio } from '@/lib/pictures';

/**
 * Picture AI — a standalone card, separate from the text writer. Describe a
 * picture, pick its shape, generate with gpt-image-1 and attach it to the
 * composer (downloaded into the normal upload path on the host side).
 */
export default function PictureCard({
  seedPrompt = '',
  onPicture,
}: {
  /** Idea text from a sibling card — prefills the prompt via the placeholder. */
  seedPrompt?: string;
  onPicture: (urls: string[]) => void;
}) {
  const [picPrompt, setPicPrompt] = useState('');
  const [picRatio, setPicRatio] = useState<PictureRatio>('4:5');
  const [picUrl, setPicUrl] = useState<string | null>(null);
  const [picBusy, setPicBusy] = useState(false);
  const [picErr, setPicErr] = useState<string | null>(null);
  const [picAttachedAt, setPicAttachedAt] = useState<number | null>(null);

  async function makePromptPicture() {
    const q = (picPrompt.trim() || seedPrompt.trim()).slice(0, 200);
    if (!q) {
      setPicErr('Describe the picture first.');
      return;
    }
    setPicErr(null);
    setPicAttachedAt(null);
    setPicBusy(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const sb = createClient();
      setPicUrl(await generateImage(sb, q, picRatio));
    } catch (e) {
      setPicErr(e instanceof Error ? e.message : 'AI generation failed.');
    } finally {
      setPicBusy(false);
    }
  }

  function usePicture() {
    if (!picUrl) return;
    onPicture([picUrl]);
    setPicAttachedAt(Date.now());
  }

  return (
    <section
      aria-label="Picture AI"
      className="mt-4 rounded-3xl border border-[#D9CCFA] bg-[#F5F0FF] p-5 dark:border-[#5B3DF0]/40 dark:bg-[#17122B]"
    >
      <div className="flex items-center gap-2">
        <ImagePlus className="h-5 w-5 text-[#5B3DF0] dark:text-[#B9A6F7]" aria-hidden="true" />
        <div>
          <p className="font-display text-base font-extrabold tracking-tight">Picture AI</p>
          <p className="text-[11px] text-muted">Describe it, pick a shape, attach it.</p>
        </div>
      </div>

      <textarea
        value={picPrompt}
        onChange={(e) => setPicPrompt(e.target.value)}
        placeholder={seedPrompt.trim() ? `e.g. ${seedPrompt.trim().slice(0, 60)}…` : 'e.g. A photo of Kyiv at dusk, cinematic…'}
        rows={2}
        aria-label="Picture description"
        className="mt-3 min-h-[52px] w-full resize-y rounded-xl border border-[#E3D9FA] bg-white/80 px-3 py-2.5 text-xs leading-relaxed text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[#5B3DF0]/40 dark:border-white/10 dark:bg-white/5"
      />

      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Picture ratio">
        {PICTURE_RATIOS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setPicRatio(r.id)}
            aria-pressed={picRatio === r.id}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
              picRatio === r.id
                ? 'border-ink bg-ink text-paper'
                : 'border-[#E3D9FA] bg-white/60 text-muted hover:text-ink dark:border-white/10 dark:bg-white/5'
            }`}
          >
            {r.label} <span className="font-medium text-muted">{r.id}</span>
          </button>
        ))}
      </div>

      {picUrl ? (
        <div className="mt-1.5 overflow-hidden rounded-xl border border-[#E3D9FA] dark:border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picUrl} alt="AI picture preview" className="max-h-56 w-full object-contain" />
        </div>
      ) : null}
      {picErr ? <p className="mt-1.5 text-xs font-bold text-[#9F2F2D] dark:text-[#F2A8A8]">{picErr}</p> : null}
      {picAttachedAt ? <p className="mt-1.5 text-xs font-bold text-[#346538] dark:text-[#9BD49B]">Attached to the composer ✓</p> : null}

      <div className="mt-1.5 flex gap-1.5">
        <button type="button" onClick={makePromptPicture} disabled={picBusy} className="btn btn-ghost flex-1 !py-2 !text-xs">
          {picBusy ? 'Rendering…' : picUrl ? 'Regenerate' : 'Generate'}
        </button>
        <button type="button" onClick={usePicture} disabled={!picUrl} className="btn btn-primary flex-1 !py-2 !text-xs">
          Use picture
        </button>
      </div>
    </section>
  );
}
