'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { generateSocial, rewritePosts, withHashtags, SOCIAL_PLATFORMS, THREAD_PLATFORM_IDS, THREAD_POST_MIN, capFor, platformLabel, type AiVariant, type RewriteOp } from '@/lib/ai';
import { AI_FORMATS, detectFormat, type AiFormatId } from '@/lib/aiFormats';
import { STUDIO_STYLES, STUDIO_TONES, WRITER_LANGUAGES, styleSampleFor } from '@/lib/aiStudio';
import { providerMeta } from '@/lib/providers';
import { useT } from '@/lib/i18n/client';
import { appMessages } from '@/lib/i18n/app';
import { fill } from '@/lib/i18n/locales';

type EmojiMode = 'auto' | 'on' | 'off';
const EMOJI_KEY: Record<EmojiMode, string> = { auto: 'emAuto', on: 'emSome', off: 'emNone' };

const REFINEMENTS: [RewriteOp, string][] = [
  ['shorter', 'rfShorter'],
  ['punchier', 'rfPunchier'],
  ['natural', 'rfNatural'],
  ['context', 'rfContext'],
  ['tone', 'rfTone'],
  ['style', 'rfStyle'],
];

/** Destination pill, brand dot when the platform is a known provider. */
function PlatformGlyph({ id }: { id: string }) {
  const meta = providerMeta(id);
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden="true" />;
}

/** iOS-style toggle, yellow when on. */
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
 * Write with AI, the mobile studio's behavior on web. The idea owns the
 * card; destinations follow the connected channels; an optional structure
 * preset (Breakdown / How-to / Story, suggested from the topic) shapes the
 * output; the result comes back as editable per-channel drafts with counters
 * and refine transforms, and only "Use this caption/thread" hands anything
 * to the composer.
 */
export default function AiCard({
  providers,
  thread,
  onThreadChange,
  parts,
  onPartsChange,
  onResult,
  appliedNote = 'Applied, edit freely.',
}: {
  /** Provider keys of the connected channels, preselects the destinations. */
  providers: string[];
  thread: boolean;
  onThreadChange: (v: boolean) => void;
  parts: number;
  onPartsChange: (n: number) => void;
  onResult: (bodies: string[]) => void;
  appliedNote?: string;
}) {
  const t = useT(appMessages);
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
  const [format, setFormat] = useState<'auto' | AiFormatId>(() => {
    try {
      const saved = window.localStorage.getItem('sosial-ai-format');
      return saved === 'breakdown' || saved === 'howto' || saved === 'story' || saved === 'auto'
        ? saved
        : 'auto';
    } catch {
      return 'auto';
    }
  });
  const [dismissedSuggestion, setDismissedSuggestion] = useState<string | null>(null);

  function pickFormat(f: 'auto' | AiFormatId) {
    setFormat(f);
    try {
      window.localStorage.setItem('sosial-ai-format', f);
    } catch {
      /* private mode */
    }
  }

  /** One-tap suggestion from the topic, shown, never auto-applied. */
  const suggested = format === 'auto' ? detectFormat(topic) : null;
  const showSuggestion = suggested !== null && dismissedSuggestion !== topic;
  const suggestedFormat = suggested ? AI_FORMATS.find((f) => f.id === suggested) : undefined;

  /* Destinations follow the connected channels, no picker in the card. */
  const known = useMemo(
    () => providers.filter((p) => SOCIAL_PLATFORMS.some((s) => s.id === p)),
    [providers],
  );
  const [platforms, setPlatforms] = useState<string[]>(() => (known.length ? known : ['any']));

  // Threads only publish as chains on four channels, narrow like mobile.
  useMemo(() => {
    if (!thread) return;
    setPlatforms((prev) => {
      const kept = prev.filter((p) => THREAD_PLATFORM_IDS.includes(p));
      return kept.length ? kept : ['x'];
    });
  }, [thread]);

  /* ---------------------------- generation ---------------------------- */
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [appliedAt, setAppliedAt] = useState<number | null>(null);
  const [draft, setDraft] = useState<AiVariant[]>([]);
  const [tab, setTab] = useState(0);
  const [dirty, setDirty] = useState(false);

  const active = draft[tab];
  const isThreadView = thread && (active?.posts.length ?? 0) > 1;
  const limit = capFor(active?.platform ?? platforms[0], thread);
  const hasCopy = draft.some((v) => v.posts.some((p) => p.trim()));

  async function run() {
    setErr(null);
    setAppliedAt(null);
    const idea = topic.trim();
    if (!idea) {
      setErr(t('aiGiveIdea'));
      return;
    }
    setBusy(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const sb = createClient();
      const formatBlock =
        format === 'auto' ? undefined : AI_FORMATS.find((f) => f.id === format)?.instructions;
      const combined = [formatBlock, instructions.trim() || undefined]
        .filter((s): s is string => Boolean(s))
        .join('\n\n');
      const variants = await generateSocial(sb, {
        topic: idea,
        platforms,
        thread,
        parts: thread ? parts : 1,
        tone,
        language,
        style,
        instructions: combined || undefined,
        emoji,
        cta,
        hashtags,
      });
      setDraft(variants);
      setTab(0);
      setDirty(false);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t('aiErr'));
    } finally {
      setBusy(false);
    }
  }

  function regenerate() {
    if (dirty && !window.confirm(t('aiConfirmOver'))) return;
    void run();
  }

  function setPost(pi: number, text: string) {
    if (!active) return;
    setDraft((d) => d.map((v, i) => (i === tab ? { ...v, posts: v.posts.map((p, j) => (j === pi ? text : p)) } : v)));
    setDirty(true);
  }

  async function applyTransform(op: RewriteOp) {
    if (!active) return;
    setErr(null);
    setBusy(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const sb = createClient();
      const posts = await rewritePosts(sb, {
        posts: active.posts,
        platform: active.platform,
        thread,
        language,
        op,
      });
      setDraft((d) => d.map((v, i) => (i === tab ? { ...v, posts } : v)));
      setDirty(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('aiRewriteErr'));
    } finally {
      setBusy(false);
    }
  }

  function transform(op: RewriteOp) {
    if (dirty && !window.confirm(t('aiConfirmRewrite'))) return;
    void applyTransform(op);
  }

  function apply() {
    if (!active) return;
    onResult(active.posts.map((p) => (hashtags ? withHashtags(p, active.hashtags) : p)));
    setAppliedAt(Date.now());
  }

  /* ------------------------------ inputs ------------------------------ */

  const langName = (id: string) => WRITER_LANGUAGES.find((l) => l.id === id)?.label ?? id;
  const langMatches = useMemo(() => {
    const q = langQuery.trim().toLowerCase();
    const list = q
      ? WRITER_LANGUAGES.filter((l) => l.id.toLowerCase().includes(q) || l.label.toLowerCase().includes(q))
      : WRITER_LANGUAGES;
    return list.slice(0, 60);
  }, [langQuery]);

  return (
    <section
      aria-label={t('aiTitle')}
      className="rounded-3xl border border-[#D9CCFA] bg-[#F5F0FF] p-5 dark:border-[#5B3DF0]/40 dark:bg-[#17122B]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#5B3DF0] dark:text-[#B9A6F7]" aria-hidden="true" />
          <div>
            <p className="font-display text-base font-extrabold tracking-tight">{t('aiTitle')}</p>
            <p className="text-[11px] text-muted">{t('aiSub')}</p>
          </div>
        </div>
      </div>

      {/* Idea */}
      <textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder={t('aiIdeaPh')}
        rows={3}
        aria-label={t('aiIdeaLbl')}
        className="mt-3 min-h-[76px] w-full resize-y rounded-xl border border-[#E3D9FA] bg-white/80 px-3 py-2.5 text-xs leading-relaxed text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[#5B3DF0]/40 dark:border-white/10 dark:bg-white/5"
      />
      <p className="mt-1 text-[11px] text-muted">{t('aiRough')}</p>

      {/* Language */}
      <p className="mt-4 text-xs font-bold text-soft">{t('aiLanguage')}</p>
      <div className="relative mt-1.5">
        <button
          type="button"
          onClick={() => setLangOpen((v) => !v)}
          aria-expanded={langOpen}
          className="flex w-full items-center gap-2 rounded-xl border border-[#E3D9FA] bg-white/80 px-3 py-2 text-xs font-bold text-ink dark:border-white/10 dark:bg-white/5"
        >
          <span className="flex-1 truncate text-left">
            {language === 'auto' ? t('aiLangAuto') : langName(language)}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${langOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {langOpen ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-line bg-card p-2 shadow-[0_18px_40px_-16px_rgba(25,21,18,0.4)]">
            <input
              value={langQuery}
              onChange={(e) => setLangQuery(e.target.value)}
              placeholder={fill(t('aiLangSearch'), { n: WRITER_LANGUAGES.length })}
              aria-label={t('aiLangSearchLbl')}
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
                {t('aiLangAuto')}
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
      <p className="mt-4 text-xs font-bold text-soft">{t('aiSound')}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={t('aiToneLbl')}>
        {STUDIO_TONES.map((toneOpt) => (
          <button
            key={toneOpt.id}
            type="button"
            onClick={() => setTone(toneOpt.id)}
            aria-pressed={tone === toneOpt.id}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
              tone === toneOpt.id
                ? 'border-ink bg-ink text-paper'
                : 'border-[#E3D9FA] bg-white/60 text-muted hover:text-ink dark:border-white/10 dark:bg-white/5'
            }`}
          >
            {t(`tone${toneOpt.id[0].toUpperCase()}${toneOpt.id.slice(1)}`)}
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
        {t('aiStyle')}
        <span className="flex-1" />
        <span className="text-muted">
          {style === 'auto' ? t('aiStyleAuto') : t(`style${STUDIO_STYLES.find((s) => s.id === style)?.id[0].toUpperCase()}${STUDIO_STYLES.find((s) => s.id === style)?.id.slice(1)}`)}
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
                  <span className="text-xs font-bold">{t(`style${s.id[0].toUpperCase()}${s.id.slice(1)}`)}</span>
                  <span className="flex-1" />
                  <span className="text-[11px] text-muted">{t(`style${s.id[0].toUpperCase()}${s.id.slice(1)}Hint`)}</span>
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
      <p className="mt-4 text-xs font-bold text-soft">{t('aiFormat')}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={t('aiFormat')}>
        {[{ value: 'post', label: t('aiFmtPost') }, { value: 'thread', label: t('aiFmtThread') }].map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onThreadChange(f.value === 'thread')}
            aria-pressed={(thread ? 'thread' : 'post') === f.value}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
              (thread ? 'thread' : 'post') === f.value
                ? 'border-ink bg-ink text-paper'
                : 'border-[#E3D9FA] bg-white/60 text-muted hover:text-ink dark:border-white/10 dark:bg-white/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {thread ? (
        <div className="mt-1.5 flex items-center justify-between rounded-xl border border-[#E3D9FA] bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-white/5">
          <span className="text-xs font-bold text-soft">{t('aiPosts')}</span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPartsChange(Math.max(3, parts - 1))}
              aria-label={t('aiFewer')}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-base font-bold leading-none text-soft shadow-sm transition hover:text-ink dark:bg-white/10"
            >
              −
            </button>
            <span className="min-w-7 text-center text-xs font-extrabold">{parts}</span>
            <button
              type="button"
              onClick={() => onPartsChange(Math.min(12, parts + 1))}
              aria-label={t('aiMore')}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-base font-bold leading-none text-soft shadow-sm transition hover:text-ink dark:bg-white/10"
            >
              +
            </button>
          </span>
        </div>
      ) : null}

      {/* Structure preset, suggested from the topic, applied by tap */}
      <p className="mt-4 text-xs font-bold text-soft">{t('aiStructure')}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={t('aiStructLbl')}>
        {(['auto', ...AI_FORMATS.map((f) => f.id)] as const).map((id) => {
          const on = format === id;
          const label = id === 'auto' ? t('aiStyleAuto') : t(`fmt${id[0].toUpperCase()}${id.slice(1)}`);
          return (
            <button
              key={id}
              type="button"
              onClick={() => pickFormat(id)}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                on
                  ? 'border-ink bg-ink text-paper'
                  : 'border-[#E3D9FA] bg-white/60 text-muted hover:text-ink dark:border-white/10 dark:bg-white/5'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {format !== 'auto' ? (
        <p className="mt-1 text-[11px] text-muted">
          {t(`fmt${format[0].toUpperCase()}${format.slice(1)}Blurb`)}
        </p>
      ) : showSuggestion && suggestedFormat ? (
        <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#E3D9FA] bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/5">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#5B3DF0] dark:text-[#B9A6F7]" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[11px] text-soft">
            {fill(t('aiLooksLike'), {
              what: t(`fmt${suggestedFormat.id[0].toUpperCase()}${suggestedFormat.id.slice(1)}`),
              blurb: t(`fmt${suggestedFormat.id[0].toUpperCase()}${suggestedFormat.id.slice(1)}Blurb`),
            })}
          </p>
          <button
            type="button"
            onClick={() => pickFormat(suggestedFormat.id)}
            className="shrink-0 rounded-full bg-ink px-3 py-1 text-[11px] font-bold text-paper transition hover:opacity-85"
          >
            {t('aiUseIt')}
          </button>
          <button
            type="button"
            onClick={() => setDismissedSuggestion(topic)}
            aria-label={t('aiDismiss')}
            className="shrink-0 rounded-full px-2 py-1 text-[11px] font-bold text-muted transition hover:text-ink"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Advanced */}
      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        aria-expanded={advanced}
        className="mt-4 flex w-full items-center gap-2 text-xs font-bold text-soft"
      >
        {t('aiAdvanced')}
        <span className="flex-1" />
        <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${advanced ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {advanced ? (
        <div className="mt-1.5 space-y-3 rounded-xl border border-[#E3D9FA] bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2">
            <span className="flex-1">
              <span className="block text-xs font-bold">{t('aiHashtags')}</span>
              <span className="block text-[11px] text-muted">{t('aiHashtagsSub')}</span>
            </span>
            <Switch on={hashtags} onToggle={() => setHashtags((v) => !v)} label={t('aiHashtags')} />
          </div>
          <div>
            <p className="text-xs font-bold">{t('aiEmoji')}</p>
            <div className="mt-1 flex gap-1" role="group" aria-label={t('aiEmojiLbl')}>
              {(['auto', 'on', 'off'] as EmojiMode[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setEmoji(o)}
                  aria-pressed={emoji === o}
                  className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-bold transition ${
                    emoji === o ? 'bg-ink text-paper' : 'bg-paper-dim text-muted hover:text-ink'
                  }`}
                >
                  {t(EMOJI_KEY[o])}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex-1">
              <span className="block text-xs font-bold">{t('aiCta')}</span>
              <span className="block text-[11px] text-muted">{t('aiCtaSub')}</span>
            </span>
            <Switch on={cta} onToggle={() => setCta((v) => !v)} label={t('aiCta')} />
          </div>
          <div>
            <p className="text-xs font-bold">{t('aiCustom')} <span className="font-medium text-muted">{t('aiOptional')}</span></p>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t('aiCustomPh')}
              rows={2}
              aria-label={t('aiCustomLbl')}
              className="field mt-1 min-h-[52px] resize-y !text-xs"
            />
          </div>
        </div>
      ) : null}

      {/* Result, editable drafts, like the mobile sheet */}
      {err ? <p className="mt-2 text-xs font-bold text-[#9F2F2D] dark:text-[#F2A8A8]">{err}</p> : null}

      {draft.length > 0 && !busy ? (
        <div className="mt-3 rounded-2xl border border-[#E3D9FA] bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2">
            <Sparkles className={`h-4 w-4 ${hasCopy ? 'text-[#346538] dark:text-[#9BD49B]' : 'text-[#9F2F2D] dark:text-[#F2A8A8]'}`} aria-hidden="true" />
            <p className="text-sm font-extrabold">
              {isThreadView ? fill(t('aiNThread'), { n: active?.posts.length ?? 0 }) : t('aiCaption')}
            </p>
          </div>

          {draft.length > 1 ? (
            <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label={t('aiChannelDrafts')}>
              {draft.map((v, i) => (
                <button
                  key={v.platform}
                  type="button"
                  role="tab"
                  aria-selected={i === tab}
                  onClick={() => setTab(i)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                    i === tab
                      ? 'border-ink bg-ink text-paper'
                      : 'border-line bg-paper text-muted hover:text-ink'
                  }`}
                >
                  {v.platform === 'any' ? null : <PlatformGlyph id={v.platform} />}
                  {platformLabel(v.platform)}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-2 space-y-2">
            {active?.posts.map((seg, i) => {
              const over = seg.length > limit;
              const tooShort = isThreadView && seg.length < THREAD_POST_MIN;
              return (
                <div key={i} className="rounded-xl border border-line bg-paper p-2">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-extrabold tracking-wide text-[#5B3DF0] dark:text-[#B9A6F7]">
                      {active.posts.length > 1 ? fill(t('aiPostN'), { n: i + 1 }) : t('aiCaption')}
                    </span>
                    <span className={`text-[11px] font-bold tabular-nums ${over ? 'text-[#9F2F2D] dark:text-[#F2A8A8]' : tooShort ? 'text-[#B98A1C] dark:text-[#E8C162]' : 'text-faint'}`}>
                      {seg.length}/{limit}{tooShort ? ` · ${fill(t('aiMin'), { n: THREAD_POST_MIN })}` : ''}
                    </span>
                  </div>
                  <textarea
                    value={seg}
                    onChange={(e) => setPost(i, e.target.value)}
                    rows={3}
                    aria-label={fill(t('aiEditPost'), { what: active.posts.length > 1 ? fill(t('aiPostWord'), { n: i + 1 }) : t('aiCaption') })}
                    className="mt-1 min-h-[56px] w-full resize-y rounded-lg border border-line-soft bg-white/80 px-2.5 py-2 text-xs leading-relaxed text-ink focus:outline-none focus:ring-2 focus:ring-[#5B3DF0]/40 dark:bg-white/5"
                  />
                </div>
              );
            })}
          </div>

          {active && active.hashtags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {active.hashtags.map((h) => (
                <span key={h} className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent-ink">
                  #{h}
                </span>
              ))}
            </div>
          ) : null}

          {/* Refine */}
          <p className="mt-3 text-xs font-bold text-soft">{t('aiRefine')}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {REFINEMENTS.map(([op, key]) => (
              <button
                key={op}
                type="button"
                onClick={() => transform(op)}
                disabled={busy}
                className="rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] font-bold text-muted transition hover:text-ink disabled:opacity-50"
              >
                {t(key)}
              </button>
            ))}
            <button
              type="button"
              onClick={regenerate}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] font-bold text-muted transition hover:text-ink disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              {t('aiRegen')}
            </button>
          </div>
        </div>
      ) : null}

      {busy ? <p className="mt-2 text-xs font-bold text-muted">{t('aiWriting')}</p> : null}

      {appliedAt ? <p className="mt-2 text-xs font-bold text-[#346538] dark:text-[#9BD49B]">{appliedNote}</p> : null}

      {/* Sticky CTA */}
      {draft.length > 0 && hasCopy && !busy ? (
        <button type="button" onClick={apply} className="btn btn-primary mt-3 w-full">
          {isThreadView ? fill(t('aiUseThread'), { n: active?.posts.length ?? 0 }) : t('aiUseCaption')}
        </button>
      ) : (
        <button type="button" onClick={run} disabled={busy} className="btn btn-primary mt-3 w-full">
          {busy ? t('aiWriting') : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {t('aiGenerate')}
            </>
          )}
        </button>
      )}
    </section>
  );
}
