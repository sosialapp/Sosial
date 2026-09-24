'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { generateCaptions, withHashtags } from '@/lib/ai';
import { STUDIO_STYLES, STUDIO_TONES, WRITER_LANGUAGES, styleSampleFor } from '@/lib/aiStudio';

type EmojiMode = 'auto' | 'on' | 'off';
const EMOJI_OPTS: { id: EmojiMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'on', label: 'Some' },
  { id: 'off', label: 'None' },
];

/** iOS-style toggle — yellow when on. */
function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-line'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`}
      />
    </button>
  );
}

/**
 * AI Generate studio card — the mobile writer's sections on web: idea,
 * language, tone, style, format (post/thread + parts) and advanced options.
 * Generates through the same edge function and hands the result back to the
 * host surface (composer, ideas). Picture AI lives in its own PictureCard.
 */
export default function AiCard({
  providers,
  thread,
  onThreadChange,
  parts,
  onPartsChange,
  onResult,
  appliedNote = 'Applied — edit freely.',
  seedTopic = '',
}: {
  /** Provider keys the copy should be sized for (strictest wins). */
  providers: string[];
  thread: boolean;
  onThreadChange: (v: boolean) => void;
  parts: number;
  onPartsChange: (n: number) => void;
  onResult: (bodies: string[]) => void;
  appliedNote?: string;
  /** Idea text from the host — used by the placeholder to nudge reuse. */
  seedTopic?: string;
}) {
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('auto');
  const [langOpen, setLangOpen] = useState(false);
  const [langQuery, setLangQuery] = useState('');
  const [tone, setTone] = useState('auto');
  const [style, setStyle] = useState('auto');
  const [styleOpen, setStyleOpen] = useState(false);
  const [hashtags, setHashtags] = useState(false);
  const [emoji, setEmoji] = useState<EmojiMode>('auto');
  const [cta, setCta] = useState(true);
  const [instructions, setInstructions] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [appliedAt, setAppliedAt] = useState<number | null>(null);

  const langName = (id: string) => WRITER_LANGUAGES.find((l) => l.id === id)?.label ?? id;
  const langMatches = useMemo(() => {
    const q = langQuery.trim().toLowerCase();
    const list = q
      ? WRITER_LANGUAGES.filter((l) => l.id.toLowerCase().includes(q) || l.label.toLowerCase().includes(q))
      : WRITER_LANGUAGES;
    return list.slice(0, 60);
  }, [langQuery]);

  async function run() {
    setErr(null);
    setAppliedAt(null);
    const t = topic.trim();
    if (!t) {
      setErr('Describe the topic first.');
      return;
    }
    if (!providers.length) {
      setErr('Pick at least one channel — the AI sizes copy to the strictest one.');
      return;
    }
    setBusy(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const sb = createClient();
      const segs = await generateCaptions(sb, {
        topic: t,
        providers,
        count: thread ? parts : 1,
        tone,
        language,
        style,
        instructions: instructions.trim() || undefined,
        emoji,
        cta,
      });
      onResult(segs.map((s) => (hashtags ? withHashtags(s.caption, s.hashtags) : s.caption)));
      setAppliedAt(Date.now());
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'AI generation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="AI Generate"
      className="rounded-3xl border border-[#D9CCFA] bg-[#F5F0FF] p-5 dark:border-[#5B3DF0]/40 dark:bg-[#17122B]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#5B3DF0] dark:text-[#B9A6F7]" aria-hidden="true" />
          <div>
            <p className="font-display text-base font-extrabold tracking-tight">AI Generate</p>
            <p className="text-[11px] text-muted">Turn your ideas into engaging posts with AI.</p>
          </div>
        </div>
      </div>

      {/* Idea */}
      <textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="e.g. Create a catchy Instagram caption about building better habits for a healthier life…"
        rows={3}
        aria-label="Your idea"
        className="mt-3 min-h-[76px] w-full resize-y rounded-xl border border-[#E3D9FA] bg-white/80 px-3 py-2.5 text-xs leading-relaxed text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[#5B3DF0]/40 dark:border-white/10 dark:bg-white/5"
      />
      <p className="mt-1 text-[11px] text-muted">Rough thoughts are enough — a phrase works.</p>

      {/* Language */}
      <p className="mt-4 text-xs font-bold text-soft">Language</p>
      <div className="relative mt-1.5">
        <button
          type="button"
          onClick={() => setLangOpen((v) => !v)}
          aria-expanded={langOpen}
          className="flex w-full items-center gap-2 rounded-xl border border-[#E3D9FA] bg-white/80 px-3 py-2 text-xs font-bold text-ink dark:border-white/10 dark:bg-white/5"
        >
          <span className="flex-1 truncate text-left">
            {language === 'auto' ? 'Auto — match my idea' : langName(language)}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${langOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {langOpen ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-line bg-card p-2 shadow-[0_18px_40px_-16px_rgba(25,21,18,0.4)]">
            <input
              value={langQuery}
              onChange={(e) => setLangQuery(e.target.value)}
              placeholder={`Search ${WRITER_LANGUAGES.length} languages…`}
              aria-label="Search languages"
              className="field !py-1.5 text-xs"
            />
            <div className="mt-1 max-h-48 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  setLanguage('auto');
                  setLangOpen(false);
                  setLangQuery('');
                }}
                className={`mt-1 flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs font-bold transition hover:bg-paper-dim ${language === 'auto' ? 'bg-accent-soft text-accent-ink' : ''}`}
              >
                Auto — match my idea
              </button>
              {langMatches.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setLanguage(l.id);
                    setLangOpen(false);
                    setLangQuery('');
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold transition hover:bg-paper-dim ${language === l.id ? 'bg-accent-soft text-accent-ink' : ''}`}
                >
                  <span className="flex-1 truncate">{l.label}</span>
                  {l.label !== l.id ? <span className="text-[11px] font-medium text-muted">{l.id}</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Tone */}
      <p className="mt-4 text-xs font-bold text-soft">How should it sound?</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Tone">
        {STUDIO_TONES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTone(t.id)}
            aria-pressed={tone === t.id}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
              tone === t.id
                ? 'border-ink bg-ink text-paper'
                : 'border-[#E3D9FA] bg-white/60 text-muted hover:text-ink dark:border-white/10 dark:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Style */}
      <button
        type="button"
        onClick={() => setStyleOpen((v) => !v)}
        aria-expanded={styleOpen}
        className="mt-4 flex w-full items-center gap-2 text-xs font-bold text-soft"
      >
        Style
        <span className="flex-1" />
        <span className="text-muted">
          {STUDIO_STYLES.find((s) => s.id === style)?.label ?? 'Auto'}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${styleOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {styleOpen ? (
        <div className="mt-1.5 space-y-1.5">
          {STUDIO_STYLES.map((s) => {
            const on = style === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                aria-pressed={on}
                className={`block w-full rounded-xl border p-2.5 text-left transition ${
                  on
                    ? 'border-[#5B3DF0] bg-white dark:bg-white/10'
                    : 'border-[#E3D9FA] bg-white/60 hover:border-[#5B3DF0]/50 dark:border-white/10 dark:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${on ? 'border-[#5B3DF0]' : 'border-line'}`} aria-hidden="true">
                    {on ? <span className="h-2 w-2 rounded-full bg-[#5B3DF0]" /> : null}
                  </span>
                  <span className="text-xs font-bold">{s.label}</span>
                  <span className="flex-1" />
                  <span className="text-[11px] text-muted">{s.hint}</span>
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-muted">
                  e.g. “{styleSampleFor(s, language)}”
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Format */}
      <p className="mt-4 text-xs font-bold text-soft">Format</p>
      <div className="mt-1.5 flex rounded-full border border-[#E3D9FA] bg-white/60 p-1 dark:border-white/10 dark:bg-white/5" role="group" aria-label="Format">
        {(['post', 'thread'] as const).map((f) => {
          const on = thread === (f === 'thread');
          return (
            <button
              key={f}
              type="button"
              onClick={() => onThreadChange(f === 'thread')}
              aria-pressed={on}
              className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-bold capitalize transition ${
                on ? 'bg-ink text-paper shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>
      {thread ? (
        <div className="mt-1.5 flex items-center justify-between rounded-xl border border-[#E3D9FA] bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-white/5">
          <span className="text-xs font-bold text-soft">Posts</span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPartsChange(Math.max(2, parts - 1))}
              aria-label="Fewer posts"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-base font-bold leading-none text-soft shadow-sm transition hover:text-ink dark:bg-white/10"
            >
              −
            </button>
            <span className="min-w-7 text-center text-xs font-extrabold">{parts}</span>
            <button
              type="button"
              onClick={() => onPartsChange(Math.min(8, parts + 1))}
              aria-label="More posts"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-base font-bold leading-none text-soft shadow-sm transition hover:text-ink dark:bg-white/10"
            >
              +
            </button>
          </span>
        </div>
      ) : null}

      {/* Advanced */}
      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        aria-expanded={advanced}
        className="mt-4 flex w-full items-center gap-2 text-xs font-bold text-soft"
      >
        Advanced options
        <span className="flex-1" />
        <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${advanced ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {advanced ? (
        <div className="mt-1.5 space-y-3 rounded-xl border border-[#E3D9FA] bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2">
            <span className="flex-1">
              <span className="block text-xs font-bold">Add hashtags</span>
              <span className="block text-[11px] text-muted">Kept separate from the copy</span>
            </span>
            <Switch on={hashtags} onToggle={() => setHashtags((v) => !v)} label="Add hashtags" />
          </div>
          <div>
            <p className="text-xs font-bold">Emoji</p>
            <div className="mt-1 flex gap-1" role="group" aria-label="Emoji">
              {EMOJI_OPTS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setEmoji(o.id)}
                  aria-pressed={emoji === o.id}
                  className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-bold transition ${
                    emoji === o.id ? 'bg-ink text-paper' : 'bg-paper-dim text-muted hover:text-ink'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex-1">
              <span className="block text-xs font-bold">Soft call-to-action</span>
              <span className="block text-[11px] text-muted">Closes with an invitation, not a demand</span>
            </span>
            <Switch on={cta} onToggle={() => setCta((v) => !v)} label="Soft call-to-action" />
          </div>
          <div>
            <p className="text-xs font-bold">Custom instructions <span className="font-medium text-muted">· optional</span></p>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. mention our launch on Friday, keep it under 3 lines…"
              rows={2}
              aria-label="Custom instructions"
              className="field mt-1 min-h-[52px] resize-y !text-xs"
            />
          </div>
        </div>
      ) : null}

      {err ? <p className="mt-2 text-xs font-bold text-[#9F2F2D] dark:text-[#F2A8A8]">{err}</p> : null}
      {appliedAt ? <p className="mt-2 text-xs font-bold text-[#346538] dark:text-[#9BD49B]">{appliedNote}</p> : null}
      <button type="button" onClick={run} disabled={busy} className="btn btn-primary mt-3 w-full">
        {busy ? (
          'Writing…'
        ) : appliedAt ? (
          'Regenerate'
        ) : (
          <>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Generate
          </>
        )}
      </button>
    </section>
  );
}
