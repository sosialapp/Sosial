'use client';

/**
 * AiStudioPanel — web port of the mobile AIGenerateSheet for the canvas
 * studio: idea, language, card count and the per-card budget. Generates through
 * the generate-studio edge function, clamps with the shared rules, then swaps
 * the whole page list (keeping the template's design) on Apply.
 */
import { useState } from 'react';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { Field, Stepper } from './controls';
import {
  AI_LANGUAGES,
  DEFAULT_BRIEF,
  RULES,
  applyGenResult,
  generateStudio,
  rulesSummary,
  type AiLanguage,
  type ContentBrief,
  type GenResult,
} from '@/lib/studio/ai';
import type { PostPage } from '@/lib/studio/model';

export default function AiStudioPanel({
  template,
  onApply,
  onClose,
}: {
  /** The current page — its design is reused for every generated card. */
  template: PostPage;
  onApply: (pages: PostPage[]) => void;
  onClose: () => void;
}) {
  const [brief, setBrief] = useState<ContentBrief>({ ...DEFAULT_BRIEF });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<GenResult | null>(null);

  const patch = (p: Partial<ContentBrief>) => setBrief((b) => ({ ...b, ...p }));

  async function run() {
    setErr(null);
    setResult(null);
    const prompt = brief.prompt.trim();
    if (!prompt) {
      setErr('Describe the topic first.');
      return;
    }
    setBusy(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const sb = createClient();
      setResult(await generateStudio(sb, { ...brief, prompt }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'AI generation failed.');
    } finally {
      setBusy(false);
    }
  }

  const usable = result?.pages ?? [];
  const canApply = usable.length > 0 && result !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink" aria-hidden="true">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-extrabold tracking-tight">AI generate</p>
          <p className="text-xs text-muted">Fill this design with card copy from an idea.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to steps"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <Field label="Your idea">
        <textarea
          value={brief.prompt}
          onChange={(e) => patch({ prompt: e.target.value })}
          placeholder="e.g. Why small habits beat big goals — 3 cards"
          rows={3}
          aria-label="Your idea"
          className="field min-h-[76px] resize-y !text-xs"
        />
      </Field>

      <Field label="Language">
        <div className="flex flex-wrap gap-1.5">
          {AI_LANGUAGES.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => patch({ language: l.id as AiLanguage })}
              aria-pressed={brief.language === l.id}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                brief.language === l.id
                  ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black'
                  : 'border-line bg-card text-muted hover:bg-paper'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Cards" hint={`${RULES.maxPages} max`}>
        <Stepper value={brief.pages} onChange={(v) => patch({ pages: v })} min={1} max={RULES.maxPages} />
      </Field>

      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Field label="Words / card">
          <Stepper value={brief.maxWordsPerPage} onChange={(v) => patch({ maxWordsPerPage: v })} step={10} min={20} max={200} />
        </Field>
        <Field label="Blocks / card">
          <Stepper value={brief.maxBlocksPerPage} onChange={(v) => patch({ maxBlocksPerPage: v })} min={1} max={RULES.maxBlocksPerPage} />
        </Field>
      </div>

      <p className="text-xs text-muted">{rulesSummary(brief)}</p>

      {err ? <p className="text-xs font-bold text-[#9F2F2D]">{err}</p> : null}

      {result ? (
        usable.length ? (
          <div className="space-y-2 rounded-2xl border border-line bg-card p-3">
            <p className="text-xs font-bold">
              {usable.length} card{usable.length === 1 ? '' : 's'} ready
            </p>
            <ul className="space-y-1 text-xs text-muted">
              {usable.map((p, i) => {
                const head = p.blocks.find((b) => b.heading)?.heading;
                const first = p.blocks[0];
                const line =
                  head ??
                  (first && 'lines' in first ? first.lines[0] : undefined) ??
                  (first && 'items' in first ? first.items[0] : undefined) ??
                  'Card';
                return (
                  <li key={i} className="truncate">
                    {i + 1} · {line}
                  </li>
                );
              })}
            </ul>
            {result.warnings.length ? (
              <ul className="space-y-0.5 border-t border-line pt-2 text-[11px] text-muted">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-xs font-bold text-[#9F2F2D]">Nothing usable came back — try a more specific idea.</p>
        )
      ) : null}

      {result && canApply ? (
        <button
          type="button"
          onClick={() => {
            onApply(applyGenResult(result, template));
            onClose();
          }}
          className="btn btn-primary w-full"
        >
          Use these cards
        </button>
      ) : null}
      <button type="button" onClick={run} disabled={busy} className="btn btn-ghost w-full">
        {busy ? 'Writing…' : canApply ? 'Regenerate' : 'Generate'}
      </button>
    </div>
  );
}
