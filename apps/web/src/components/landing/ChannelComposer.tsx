'use client';

import { useMemo, useState } from 'react';
import { BrandIcon } from '@/components/BrandIcon';
import { ALL_PROVIDERS, PROVIDER_META } from '@/lib/providers';
import type { ProviderKey } from '@/lib/types';

/**
 * The landing page's interactive centrepiece: type one idea and watch it lay
 * itself out across every channel, each with its true character limit. Nothing
 * here is faked — the counter, the bar and the trim all use the same
 * PROVIDER_META limits the composer enforces.
 */

const DEFAULT_IDEA =
  'We just shipped team approvals. Teammates draft, you approve in one tap, and nothing goes out before you say so.';

const HINTS: Record<ProviderKey, string> = {
        x: 'Tightest limit. Keep one idea per post.',
  bluesky: 'Short and honest. Alt text expected.',
  threads: 'Conversational. Hashtags do little.',
  mastodon: 'Community-first. Real hashtags help.',
  pinterest: 'Written like a search query.',
  instagram: 'Hook in the first ~125 characters.',
  tiktok: 'Native, sound-off friendly caption.',
  linkedin: 'First two lines decide the read.',
  youtube: 'Title and description do the work.',
  facebook: 'Room for a longer story.',
};

function useTrimmed(text: string, limit: number) {
  return useMemo(() => {
    const over = text.length > limit;
    const shown = over ? `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…` : text;
    return { over, shown, pct: Math.min(100, (text.length / limit) * 100) };
  }, [text, limit]);
}

function ChannelCard({ provider, idea }: { provider: ProviderKey; idea: string }) {
  const meta = PROVIDER_META[provider];
  const { over, shown, pct } = useTrimmed(idea, meta.limit);

  return (
    <article className="card reveal flex flex-col p-4">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${meta.color}18`, color: meta.color }}
        >
          <BrandIcon provider={provider} className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{meta.label}</span>
          <span className="block text-[11px] capitalize text-muted">{meta.kind}</span>
        </span>
        <span className="ml-auto text-[11px] font-bold tabular-nums text-faint">
          {idea.length.toLocaleString()}/{meta.limit.toLocaleString()}
        </span>
      </div>

      <p className="mt-3 flex-1 text-[13px] leading-relaxed text-soft">{shown}</p>
      {over ? (
        <p className="mt-2 text-[11px] font-bold text-ink">Trimmed to fit {meta.label}</p>
      ) : (
        <p className="mt-2 text-[11px] text-faint">{HINTS[provider]}</p>
      )}

      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface" aria-hidden="true">
        <div
          className={`h-full rounded-full transition-all duration-300 ${over ? 'bg-accent' : 'bg-leaf'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </article>
  );
}

export default function ChannelComposer() {
  const [idea, setIdea] = useState(DEFAULT_IDEA);
  const [selected, setSelected] = useState<ProviderKey[]>([...ALL_PROVIDERS]);

  const toggle = (p: ProviderKey) =>
    setSelected((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <label htmlFor="idea" className="eyebrow">
          One idea
        </label>
        <textarea
          id="idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={5}
          className="field mt-3 resize-none font-sans text-sm leading-relaxed"
        />

        <div className="mt-4 flex items-center justify-between">
          <p className="eyebrow">Publish to</p>
          <div className="flex gap-3 text-[11px] font-bold">
            <button
              type="button"
              className="text-ink hover:underline"
              onClick={() => setSelected([...ALL_PROVIDERS])}
            >
              All
            </button>
            <button
              type="button"
              className="text-muted hover:text-ink"
              onClick={() => setSelected([])}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {ALL_PROVIDERS.map((p) => {
            const meta = PROVIDER_META[p];
            const on = selected.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => toggle(p)}
                aria-pressed={on}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  on
                    ? 'border-ink bg-paper-dim text-ink'
                    : 'border-line bg-paper text-muted hover:border-faint'
                }`}
              >
                <BrandIcon provider={p} className="h-3.5 w-3.5" />
                {meta.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="btn btn-bolt" aria-hidden="true">
            Schedule {selected.length} {selected.length === 1 ? 'channel' : 'channels'}
          </span>
          <span className="text-xs text-muted">Try it. This preview is live.</span>
        </div>
      </div>

      <div>
        {selected.length === 0 ? (
          <div className="card flex min-h-[240px] items-center justify-center p-8 text-center text-sm text-muted">
            Pick a channel to see how this idea adapts.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {selected.map((p) => (
              <ChannelCard key={p} provider={p} idea={idea} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
