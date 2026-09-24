'use client';

/**
 * AiStudioPanel — web port of the mobile AIGenerateSheet for the canvas
 * studio: idea, language, card count and the per-card budget. Generates through
 * the generate-studio edge function, clamps with the shared rules, then swaps
 * the whole page list (keeping the template's design) on Apply.
 */
import { useMemo, useState } from 'react';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { Field, Stepper } from './controls';
import {
  DEFAULT_BRIEF,
  RULES,
  applyGenResult,
  generateStudio,
  rulesSummary,
  type ContentBrief,
  type GenResult,
} from '@/lib/studio/ai';
import { WRITER_LANGUAGES } from '@/lib/aiStudio';
import { newBlock, type BlockType, type PostPage } from '@/lib/studio/model';

/** Extra starter blocks the user can append to every generated card. */
const EXTRAS: { id: BlockType; label: string; hint: string }[] = [
  { id: 'image', label: 'Image', hint: 'Photo slot' },
  { id: 'table', label: 'Table', hint: 'Comparison' },
  { id: 'bar', label: 'Chart', hint: 'Bars' },
  { id: 'vbar', label: 'Columns', hint: 'Columns' },
];

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
  const [langOpen, setLangOpen] = useState(false);
  const [langQuery, setLangQuery] = useState('');
  const [extras, setExtras] = useState<BlockType[]>([]);

  const patch = (p: Partial<ContentBrief>) => setBrief((b) => ({ ...b, ...p }));

  const langName = (id: string) => WRITER_LANGUAGES.find((l) => l.id === id)?.label ?? id;
  const langMatches = useMemo(() => {
    const q = langQuery.trim().toLowerCase();
    const list = q
      ? WRITER_LANGUAGES.filter((l) => l.id.toLowerCase().includes(q) || l.label.toLowerCase().includes(q))
      : WRITER_LANGUAGES;
    return list.slice(0, 60);
  }, [langQuery]);

  const toggleExtra = (t: BlockType) =>
    setExtras((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

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
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangOpen((v) => !v)}
            aria-expanded={langOpen}
            className="flex w-full items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold"
          >
            <span className="flex-1 truncate text-left">
              {brief.language === 'auto' ? 'Auto — match my idea' : langName(brief.language)}
            </span>
            <span className="text-[11px] text-faint">{WRITER_LANGUAGES.length} languages</span>
          </button>
          {langOpen ? (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-line bg-card p-2 shadow-[0_18px_40px_-16px_rgba(25,21,18,0.4)]">
              <input
                value={langQuery}
                onChange={(e) => setLangQuery(e.target.value)}
                placeholder="Search languages…"
                aria-label="Search languages"
                className="field !py-1.5 text-xs"
              />
              <div className="mt-1 max-h-48 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    patch({ language: 'auto' });
                    setLangOpen(false);
                    setLangQuery('');
                  }}
                  className={`mt-1 flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs font-bold transition hover:bg-paper-dim ${brief.language === 'auto' ? 'bg-accent-soft text-accent-ink' : ''}`}
                >
                  Auto — match my idea
                </button>
                {langMatches.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      patch({ language: l.id });
                      setLangOpen(false);
                      setLangQuery('');
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold transition hover:bg-paper-dim ${brief.language === l.id ? 'bg-accent-soft text-accent-ink' : ''}`}
                  >
                    <span className="flex-1 truncate">{l.label}</span>
                    {l.label !== l.id ? <span className="text-[11px] font-medium text-faint">{l.id}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Field>

      <Field label="Cards" hint={`${RULES.maxPages} max`}>
        <Stepper value={brief.pages} onChange={(v) => patch({ pages: v })} min={1} max={RULES.maxPages} />
      </Field>

      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Field label="Words / card">
          <Stepper value={brief.maxWordsPerPage} onChange={(v) => patch({ maxWordsPerPage: v })} step={10} min={20} max={300} />
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
            <div className="border-t border-line pt-2">
              <p className="text-xs font-bold">Boost each card with <span className="font-medium text-faint">· optional</span></p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {EXTRAS.map((x) => {
                  const on = extras.includes(x.id);
                  return (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => toggleExtra(x.id)}
                      aria-pressed={on}
                      title={x.hint}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                        on
                          ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black'
                          : 'border-line bg-paper text-muted hover:text-ink'
                      }`}
                    >
                      + {x.label}
                    </button>
                  );
                })}
              </div>
              {extras.length ? (
                <p className="mt-1 text-[11px] text-faint">Added after the AI copy — fill them in the Content step.</p>
              ) : null}
            </div>
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
            const pages = applyGenResult(result, template);
            for (const pg of pages) {
              for (const t of extras) pg.blocks.push(newBlock(t));
            }
            onApply(pages);
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
