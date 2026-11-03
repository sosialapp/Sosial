'use client';

/**
 * AiStudioPanel, the canvas studio's AI: one prompt box, like the post writer.
 * The prompt is the brief ("5 habits for better sleep, one per card"); card
 * count, length and language are optional chips that default to Auto and follow
 * what the prompt says. Generates through the generate-studio edge function,
 * clamps with the shared rules, then swaps the whole page list (keeping the
 * template's design) on Use. Mirrors mobile AIGenerateSheet.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ChevronLeft, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import {
  DEFAULT_BRIEF,
  RULES,
  applyGenResult,
  generateStudio,
  type GenResult,
} from '@/lib/studio/ai';
import { WRITER_LANGUAGES } from '@/lib/aiStudio';
import { CAROUSEL_CREDITS, MAX_PROMPT, readCardCount } from '@/lib/aiPrompt';
import { newBlock, type BlockType, type PostPage } from '@/lib/studio/model';
import { useMessages } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n/locales';
import { Chip, MenuRow, useMenuDismiss } from '@/components/AiPromptBits';

/** Extra starter blocks the user can append to every generated card. */
const EXTRAS: { id: BlockType; key: string }[] = [
  { id: 'image', key: 'aisExImage' },
  { id: 'table', key: 'aisExTable' },
  { id: 'bar', key: 'aisExChart' },
  { id: 'vbar', key: 'aisExColumns' },
];

const EXAMPLES = ['aisEx1', 'aisEx2', 'aisEx3'];

type Length = 'standard' | 'short';
type Menu = 'cards' | 'length' | 'more';

/** Short halves the per-card budget and keeps one block; standard is the default brief. */
const LENGTHS: Record<Length, { words: number; blocks: number }> = {
  standard: { words: DEFAULT_BRIEF.maxWordsPerPage, blocks: DEFAULT_BRIEF.maxBlocksPerPage },
  short: { words: Math.round(DEFAULT_BRIEF.maxWordsPerPage / 2), blocks: 1 },
};

export default function AiStudioPanel({
  template,
  onApply,
  onClose,
}: {
  /** The current page, its design is reused for every generated card. */
  template: PostPage;
  onApply: (pages: PostPage[]) => void;
  onClose: () => void;
}) {
  const t = useMessages();
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState('');
  const [pages, setPages] = useState(DEFAULT_BRIEF.pages);
  const [length, setLength] = useState<Length>('standard');
  const [language, setLanguage] = useState('auto');
  const [menu, setMenu] = useState<Menu | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<GenResult | null>(null);
  const [extras, setExtras] = useState<BlockType[]>([]);
  /** Set once the user picks a card count; the prompt no longer moves it. */
  const pagesTouched = useRef(false);

  useMenuDismiss(menu !== null, () => setMenu(null));
  const toggleMenu = (m: Menu) => setMenu((cur) => (cur === m ? null : m));

  // The box grows with the prompt, like a chat input.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [prompt]);

  function onPrompt(text: string) {
    setPrompt(text.slice(0, MAX_PROMPT));
    if (pagesTouched.current) return;
    setPages(readCardCount(text, RULES.maxPages) ?? DEFAULT_BRIEF.pages);
  }

  const toggleExtra = (id: BlockType) =>
    setExtras((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function run() {
    setMenu(null);
    setErr(null);
    const idea = prompt.trim();
    if (!idea) {
      setErr(t('aiGiveIdea'));
      boxRef.current?.focus();
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      setResult(
        await generateStudio(createClient(), {
          prompt: idea,
          language,
          pages,
          maxWordsPerPage: LENGTHS[length].words,
          maxBlocksPerPage: LENGTHS[length].blocks,
        }),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('aiErr'));
    } finally {
      setBusy(false);
    }
  }

  const usable = result?.pages ?? [];
  const langName = (id: string) => WRITER_LANGUAGES.find((l) => l.id === id)?.label ?? id;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink" aria-hidden="true">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-extrabold tracking-tight">{t('aiTitle')}</p>
          <p className="text-xs text-muted">{t('aisSub')}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('aisBack')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* The prompt box: type, pick nothing, press send. */}
      <div className="rounded-2xl border border-line bg-card transition focus-within:border-ink/35 focus-within:shadow-[0_0_0_3px_rgba(255,198,46,0.18)]">
        <textarea
          ref={boxRef}
          value={prompt}
          onChange={(e) => onPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void run();
            }
          }}
          placeholder={t('aisPromptPh')}
          rows={2}
          maxLength={MAX_PROMPT}
          aria-label={t('aiPromptLbl')}
          className="block max-h-60 min-h-[88px] w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-base leading-relaxed text-ink placeholder:text-faint focus:outline-none sm:text-[15px]"
        />
        <div className="flex items-start gap-1 border-t border-line-soft px-2 py-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
            <Chip
              label={pages === 1 ? t('aisCard1') : fill(t('aisCardsN'), { n: pages })}
              open={menu === 'cards'}
              onOpen={() => toggleMenu('cards')}
            >
              <p className="px-1 pb-1.5 pt-1 text-xs font-semibold text-faint">{t('aisHowMany')}</p>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: RULES.maxPages - RULES.minPages + 1 }, (_, i) => RULES.minPages + i).map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={pages === n}
                    onClick={() => {
                      pagesTouched.current = true;
                      setPages(n);
                    }}
                    className={`h-9 w-9 rounded-full text-sm font-bold transition ${pages === n ? 'bg-ink text-paper' : 'bg-surface text-soft hover:text-ink'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Chip>
            <Chip
              label={`${t('aisLength')}: ${t(length === 'short' ? 'aisLenShort' : 'aisLenStandard')}`}
              open={menu === 'length'}
              onOpen={() => toggleMenu('length')}
              active={length !== 'standard'}
            >
              {(['standard', 'short'] as Length[]).map((l) => (
                <MenuRow
                  key={l}
                  on={length === l}
                  onClick={() => {
                    setLength(l);
                    setMenu(null);
                  }}
                >
                  {t(l === 'short' ? 'aisLenShort' : 'aisLenStandard')}
                </MenuRow>
              ))}
            </Chip>
            <Chip
              label={language === 'auto' ? t('aiMoreOpts') : langName(language)}
              open={menu === 'more'}
              onOpen={() => toggleMenu('more')}
              active={language !== 'auto'}
              align="right"
            >
              <label className="block p-1">
                <span className="block text-sm font-semibold">{t('aiLanguage')}</span>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="field mt-1 !py-1.5 !text-xs">
                  <option value="auto">{t('aiLangAuto')}</option>
                  {WRITER_LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </Chip>
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            aria-label={t('aiGenerate')}
            title={`${t('aiEnterHint')} · ${fill(t('aiCreditsN'), { n: CAROUSEL_CREDITS })}`}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${prompt.trim() ? 'bg-bolt text-on-accent hover:bg-bolt-deep' : 'bg-surface text-faint'} disabled:opacity-60`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {err ? <p className="text-sm font-semibold text-[#9F2F2D] dark:text-[#F2A8A8]">{err}</p> : null}

      {/* Empty state: a few prompts to tap. */}
      {!result && !prompt && !busy ? (
        <div>
          <p className="px-1 pb-1 text-xs font-semibold text-faint">{t('aiTry')}</p>
          {EXAMPLES.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                onPrompt(t(k));
                boxRef.current?.focus();
              }}
              className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm text-soft transition hover:bg-surface hover:text-ink"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-faint group-hover:text-ink" aria-hidden="true" />
              <span className="min-w-0 flex-1">{t(k)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {busy && !result ? (
        <div className="space-y-2 rounded-2xl border border-line bg-card p-4" aria-label={t('aiWriting')}>
          {Array.from({ length: Math.min(pages, 4) }, (_, i) => (
            <div key={i} className="h-3.5 animate-pulse rounded-full bg-surface" style={{ width: `${90 - i * 12}%` }} />
          ))}
        </div>
      ) : null}

      {result ? (
        usable.length ? (
          <div className={`rounded-2xl border border-line bg-card ${busy ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2 border-b border-line-soft py-1.5 pl-4 pr-2">
              <p className="flex-1 text-xs font-bold text-faint">{fill(t('aisReady'), { n: usable.length })}</p>
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy}
                aria-label={t('aisRegen')}
                title={t('aisRegen')}
                className="grid h-8 w-8 place-items-center rounded-full text-soft transition hover:bg-surface hover:text-ink disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            </div>
            <ol className="divide-y divide-line-soft">
              {usable.map((p, i) => {
                const head = p.blocks.find((b) => b.heading)?.heading;
                const first = p.blocks[0];
                const line =
                  head ??
                  (first && 'lines' in first ? first.lines[0] : undefined) ??
                  (first && 'items' in first ? first.items[0] : undefined) ??
                  fill(t('aisCardN'), { n: i + 1 });
                return (
                  <li key={i} className="flex gap-3 px-4 py-2.5 text-sm">
                    <span className="w-4 shrink-0 text-right tabular-nums text-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{line}</span>
                  </li>
                );
              })}
            </ol>
            <div className="border-t border-line-soft px-4 py-3">
              <p className="text-xs font-semibold text-faint">{t('aisBoost')}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {EXTRAS.map((x) => {
                  const on = extras.includes(x.id);
                  return (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => toggleExtra(x.id)}
                      aria-pressed={on}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        on
                          ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black'
                          : 'border-line bg-paper text-muted hover:text-ink'
                      }`}
                    >
                      + {t(x.key)}
                    </button>
                  );
                })}
              </div>
            </div>
            {result.warnings.length ? (
              <ul className="space-y-0.5 border-t border-line-soft px-4 py-2.5 text-xs text-faint">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : null}
            <div className="border-t border-line-soft px-3 py-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const out = applyGenResult(result, template);
                  for (const pg of out) {
                    for (const x of extras) pg.blocks.push(newBlock(x));
                  }
                  onApply(out);
                  onClose();
                }}
                className="btn btn-bolt btn-sm w-full"
              >
                {t('aisUse')}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold text-[#9F2F2D] dark:text-[#F2A8A8]">{t('aisNothing')}</p>
        )
      ) : null}
    </div>
  );
}
