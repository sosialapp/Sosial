'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, CalendarClock, Check, ChevronDown, Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { generateSocial, rewritePosts, withHashtags, SOCIAL_PLATFORMS, THREAD_PLATFORM_IDS, THREAD_POST_MIN, capFor, platformLabel, type AiVariant, type RewriteOp } from '@/lib/ai';
import { MAX_PARTS, MAX_POSTS, MAX_PROMPT, MIN_PARTS, angleFor, creditsFor, readPromptHints } from '@/lib/aiPrompt';
import { STUDIO_TONES, WRITER_LANGUAGES } from '@/lib/aiStudio';
import { providerMeta } from '@/lib/providers';
import { useMessages } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n/locales';
import SegmentedPills from '@/components/ui/segmented-pills';

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

const EXAMPLES = ['aiEx1', 'aiEx2', 'aiEx3'];

type Menu = 'channels' | 'shape' | 'tone' | 'more' | `refine-${number}`;

/** One generated post (or thread) in the result list. */
interface Draft {
  id: number;
  /** Position in the set, picks the writer angle. */
  index: number;
  total: number;
  thread: boolean;
  variants: AiVariant[];
  tab: number;
  busy: boolean;
  err: string | null;
  dirty: boolean;
}

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

/** Small inline option chip with its own popover. */
function Chip({
  label,
  open,
  onOpen,
  children,
  align = 'left',
  active = false,
}: {
  label: ReactNode;
  open: boolean;
  onOpen: () => void;
  children: ReactNode;
  align?: 'left' | 'right';
  active?: boolean;
}) {
  return (
    <span className="relative" data-ai-menu>
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
          active
            ? 'border-[#5B3DF0]/40 bg-[#5B3DF0]/10 text-[#4A2FD6] dark:text-[#C9B9FA]'
            : 'border-line bg-paper text-soft hover:text-ink'
        }`}
      >
        {label}
        <ChevronDown className={`h-3 w-3 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open ? (
        <div
          className={`absolute top-full z-30 mt-1.5 w-64 rounded-xl border border-line bg-card p-2 shadow-[0_18px_40px_-16px_rgba(25,21,18,0.4)] ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children}
        </div>
      ) : null}
    </span>
  );
}

function MenuRow({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold transition hover:bg-paper-dim ${on ? 'bg-accent-soft text-accent-ink' : ''}`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {on ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
    </button>
  );
}

/**
 * Write with AI, one prompt box. The prompt is the brief ("3 posts announcing
 * our summer sale, friendly tone"); channels, shape, tone and the rest are
 * optional chips that default to Auto and follow what the prompt says. Each
 * result is an editable card that can be re-rolled, refined, sent to the
 * composer or sent to the composer in schedule mode. Mirrors mobile AICopySheet.
 */
export default function AiCard({
  providers,
  thread: hostThread,
  onThreadChange,
  parts: hostParts,
  onPartsChange,
  onResult,
  onSchedule,
  appliedNote = 'Applied, edit freely.',
}: {
  /** Provider keys of the connected channels, preselects the destinations. */
  providers: string[];
  thread: boolean;
  onThreadChange: (v: boolean) => void;
  parts: number;
  onPartsChange: (n: number) => void;
  onResult: (bodies: string[]) => void;
  /** When set, cards also offer "Schedule": apply, then the host opens its schedule mode. */
  onSchedule?: () => void;
  appliedNote?: string;
}) {
  const t = useMessages();
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(1);

  const [prompt, setPrompt] = useState('');
  const [menu, setMenu] = useState<Menu | null>(null);

  /* ------------------------------ options ------------------------------ */
  const [thread, setThread] = useState(hostThread);
  const [parts, setParts] = useState(Math.max(MIN_PARTS, Math.min(MAX_PARTS, hostParts)));
  const [count, setCount] = useState(1);
  const [tone, setTone] = useState('auto');
  const [language, setLanguage] = useState('auto');
  const [hashtags, setHashtags] = useState(false);
  const [emoji, setEmoji] = useState<EmojiMode>('auto');
  const [cta, setCta] = useState(true);
  /** Chips the user set by hand; the prompt no longer moves them. */
  const touched = useRef({ shape: false, channels: false });
  /** The host's mode when the card mounted, what a prompt without hints falls back to. */
  const baseThread = useRef(hostThread);

  /* Destinations follow the connected channels until the user picks. */
  const known = useMemo(
    () => providers.filter((p) => SOCIAL_PLATFORMS.some((s) => s.id === p)),
    [providers],
  );
  const knownKey = known.join(',');
  const [platforms, setPlatforms] = useState<string[]>(() => (known.length ? known : ['any']));
  useEffect(() => {
    if (!touched.current.channels) setPlatforms(known.length ? known : ['any']);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownKey]);

  // Threads only publish as chains on four channels.
  const destinations = useMemo(() => {
    if (!thread) return platforms;
    const kept = platforms.filter((p) => THREAD_PLATFORM_IDS.includes(p));
    return kept.length ? kept : ['x'];
  }, [platforms, thread]);

  function onPrompt(text: string) {
    setPrompt(text.slice(0, MAX_PROMPT));
    if (touched.current.shape) return;
    const h = readPromptHints(text);
    setThread(h.thread ? true : baseThread.current);
    if (h.parts) setParts(h.parts);
    setCount(h.thread ? 1 : (h.count ?? 1));
  }

  function togglePlatform(id: string) {
    touched.current.channels = true;
    if (id === 'any') return setPlatforms(['any']);
    setPlatforms((prev) => {
      const rest = prev.filter((x) => x !== 'any');
      const out = rest.includes(id) ? rest.filter((x) => x !== id) : [...rest, id];
      return out.length ? out : ['any'];
    });
  }

  // Popovers close on outside click and Escape.
  useEffect(() => {
    if (!menu) return;
    const down = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest('[data-ai-menu]')) setMenu(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [menu]);

  // The box grows with the prompt, like a chat input.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [prompt]);

  const toggleMenu = (m: Menu) => setMenu((cur) => (cur === m ? null : m));

  /* ---------------------------- generation ---------------------------- */
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<number | null>(null);

  const anyBusy = drafts.some((d) => d.busy);
  const total = thread ? 1 : count;

  const patch = (id: number, p: Partial<Draft> | ((d: Draft) => Partial<Draft>)) =>
    setDrafts((list) => list.map((d) => (d.id === id ? { ...d, ...(typeof p === 'function' ? p(d) : p) } : d)));

  async function writeOne(d: Draft, fresh: boolean) {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const variants = await generateSocial(createClient(), {
        topic: prompt.trim(),
        platforms: destinations,
        thread: d.thread,
        parts: d.thread ? parts : 1,
        tone,
        language,
        instructions: angleFor(d.index, d.total, fresh),
        emoji,
        cta,
        hashtags,
      });
      patch(d.id, { variants, tab: 0, busy: false, err: null, dirty: false });
    } catch (e) {
      patch(d.id, { busy: false, err: e instanceof Error ? e.message : t('aiErr') });
    }
  }

  function run() {
    setErr(null);
    setAppliedId(null);
    setMenu(null);
    if (!prompt.trim()) {
      setErr(t('aiGiveIdea'));
      boxRef.current?.focus();
      return;
    }
    if (anyBusy) return;
    if (drafts.some((d) => d.dirty) && !window.confirm(t('aiConfirmOver'))) return;
    const fresh: Draft[] = Array.from({ length: total }, (_, i) => ({
      id: nextId.current++,
      index: i,
      total,
      thread,
      variants: [],
      tab: 0,
      busy: true,
      err: null,
      dirty: false,
    }));
    setDrafts(fresh);
    for (const d of fresh) void writeOne(d, false);
  }

  function regenerateOne(d: Draft) {
    if (d.busy) return;
    if (d.dirty && !window.confirm(t('aiConfirmOver'))) return;
    if (!prompt.trim()) {
      setErr(t('aiGiveIdea'));
      return;
    }
    const next = { ...d, thread, busy: true, err: null };
    patch(d.id, { thread, busy: true, err: null });
    void writeOne(next, true);
  }

  function setPost(d: Draft, pi: number, text: string) {
    patch(d.id, (cur) => ({
      dirty: true,
      variants: cur.variants.map((v, i) => (i === cur.tab ? { ...v, posts: v.posts.map((p, j) => (j === pi ? text : p)) } : v)),
    }));
  }

  async function refine(d: Draft, op: RewriteOp) {
    setMenu(null);
    const active = d.variants[d.tab];
    if (!active) return;
    if (d.dirty && !window.confirm(t('aiConfirmRewrite'))) return;
    patch(d.id, { busy: true, err: null });
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const posts = await rewritePosts(createClient(), {
        posts: active.posts,
        platform: active.platform,
        thread: d.thread,
        language,
        op,
      });
      patch(d.id, (cur) => ({
        busy: false,
        dirty: true,
        variants: cur.variants.map((v, i) => (i === cur.tab ? { ...v, posts } : v)),
      }));
    } catch (e) {
      patch(d.id, { busy: false, err: e instanceof Error ? e.message : t('aiRewriteErr') });
    }
  }

  function apply(d: Draft, schedule = false) {
    const active = d.variants[d.tab];
    if (!active) return;
    const bodies = active.posts.map((p) => (hashtags ? withHashtags(p, active.hashtags) : p));
    const asThread = d.thread && bodies.length > 1;
    if (asThread !== hostThread) onThreadChange(asThread);
    if (asThread && bodies.length !== hostParts) onPartsChange(bodies.length);
    onResult(bodies);
    if (schedule) onSchedule?.();
    setAppliedId(d.id);
  }

  /* ------------------------------ labels ------------------------------ */

  const labelOf = (id: string) => (id === 'any' ? t('aiAllChannels') : platformLabel(id));
  const toneLabel = (id: string) => t(`tone${id[0].toUpperCase()}${id.slice(1)}`);
  const channelsLabel =
    destinations.length === 1 ? labelOf(destinations[0]) : fill(t('aiNChannels'), { n: destinations.length });
  const shapeLabel = thread
    ? fill(t('aiThreadN'), { n: parts })
    : count === 1
      ? t('aiCount1')
      : fill(t('aiCountN'), { n: count });
  const channelChoices = thread
    ? SOCIAL_PLATFORMS.filter((p) => THREAD_PLATFORM_IDS.includes(p.id))
    : SOCIAL_PLATFORMS;
  const moreActive = language !== 'auto' || hashtags || emoji !== 'auto' || !cta;
  const credits = creditsFor(total, thread);

  return (
    <section
      aria-label={t('aiTitle')}
      className="rounded-3xl border border-[#D9CCFA] bg-[#F5F0FF] p-5 dark:border-[#5B3DF0]/40 dark:bg-[#17122B]"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[#5B3DF0] dark:text-[#B9A6F7]" aria-hidden="true" />
        <div>
          <p className="font-display text-base font-extrabold tracking-tight">{t('aiTitle')}</p>
          <p className="text-[11px] text-muted">{t('aiSub')}</p>
        </div>
      </div>

      {/* The prompt box: type, pick nothing, press send. A div, not a form:
          the card renders inside the composer's form. */}
      <div
        className="mt-3 rounded-2xl border border-[#E3D9FA] bg-white/90 shadow-sm focus-within:ring-2 focus-within:ring-[#5B3DF0]/40 dark:border-white/10 dark:bg-white/5"
      >
        <textarea
          ref={boxRef}
          value={prompt}
          onChange={(e) => onPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              run();
            }
          }}
          placeholder={t('aiPromptPh')}
          rows={2}
          maxLength={MAX_PROMPT}
          aria-label={t('aiPromptLbl')}
          className="block max-h-60 min-h-[64px] w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-sm leading-relaxed text-ink placeholder:text-muted focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-2.5 pt-1">
          <Chip
            label={
              <>
                {destinations.length === 1 && destinations[0] !== 'any' ? <PlatformGlyph id={destinations[0]} /> : null}
                {channelsLabel}
              </>
            }
            open={menu === 'channels'}
            onOpen={() => toggleMenu('channels')}
          >
            <p className="px-2.5 pb-1 pt-0.5 text-[11px] font-bold text-muted">{t('aiChannels')}</p>
            <div className="max-h-64 overflow-y-auto">
              {channelChoices.map((p) => (
                <MenuRow key={p.id} on={destinations.includes(p.id)} onClick={() => togglePlatform(p.id)}>
                  {p.id === 'any' ? null : <PlatformGlyph id={p.id} />}
                  <span className="truncate">{labelOf(p.id)}</span>
                </MenuRow>
              ))}
            </div>
            {thread ? <p className="px-2.5 pt-1.5 text-[11px] text-muted">{t('aiThreadOnly')}</p> : null}
          </Chip>

          <Chip label={shapeLabel} open={menu === 'shape'} onOpen={() => toggleMenu('shape')} active={thread || count > 1}>
            <SegmentedPills
              ariaLabel={t('aiHowMany')}
              size="sm"
              buttonClassName="flex-1"
              value={thread ? 'thread' : 'post'}
              onChange={(v) => {
                touched.current.shape = true;
                setThread(v === 'thread');
              }}
              options={[
                { value: 'post', label: t('aiFmtPost') },
                { value: 'thread', label: t('aiFmtThread') },
              ]}
            />
            <p className="px-1 pb-1 pt-2.5 text-[11px] font-bold text-muted">{thread ? t('aiThreadLen') : t('aiHowMany')}</p>
            <div className="flex flex-wrap gap-1">
              {(thread
                ? Array.from({ length: MAX_PARTS - MIN_PARTS + 1 }, (_, i) => MIN_PARTS + i)
                : Array.from({ length: MAX_POSTS }, (_, i) => i + 1)
              ).map((n) => {
                const on = (thread ? parts : count) === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      touched.current.shape = true;
                      if (thread) setParts(n);
                      else setCount(n);
                    }}
                    className={`h-8 w-8 rounded-lg text-xs font-extrabold transition ${on ? 'bg-ink text-paper' : 'bg-paper-dim text-soft hover:text-ink'}`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </Chip>

          <Chip
            label={`${t('aiTone')}: ${toneLabel(tone)}`}
            open={menu === 'tone'}
            onOpen={() => toggleMenu('tone')}
            active={tone !== 'auto'}
          >
            {STUDIO_TONES.map((o) => (
              <MenuRow
                key={o.id}
                on={tone === o.id}
                onClick={() => {
                  setTone(o.id);
                  setMenu(null);
                }}
              >
                {toneLabel(o.id)}
              </MenuRow>
            ))}
            <p className="px-2.5 pt-1.5 text-[11px] text-muted">{t('aiAutoHint')}</p>
          </Chip>

          <Chip label={t('aiMoreOpts')} open={menu === 'more'} onOpen={() => toggleMenu('more')} active={moreActive}>
            <div className="space-y-3 p-1">
              <label className="block">
                <span className="block text-xs font-bold">{t('aiLanguage')}</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="field mt-1 !py-1.5 !text-xs"
                >
                  <option value="auto">{t('aiLangAuto')}</option>
                  {WRITER_LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs font-bold">{t('aiHashtags')}</span>
                <Switch on={hashtags} onToggle={() => setHashtags((v) => !v)} label={t('aiHashtags')} />
              </div>
              <div>
                <p className="text-xs font-bold">{t('aiEmoji')}</p>
                <SegmentedPills
                  ariaLabel={t('aiEmoji')}
                  className="mt-1"
                  size="sm"
                  buttonClassName="flex-1"
                  value={emoji}
                  onChange={setEmoji}
                  options={(['auto', 'on', 'off'] as EmojiMode[]).map((o) => ({ value: o, label: t(EMOJI_KEY[o]) }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs font-bold">{t('aiCta')}</span>
                <Switch on={cta} onToggle={() => setCta((v) => !v)} label={t('aiCta')} />
              </div>
            </div>
          </Chip>

          <span className="flex-1" />
          <span className="text-[11px] font-bold tabular-nums text-faint" title={t('aiCreditsHint')}>
            {fill(t('aiCreditsN'), { n: credits })}
          </span>
          <button
            type="button"
            onClick={run}
            disabled={anyBusy}
            aria-label={t('aiGenerate')}
            title={t('aiEnterHint')}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
              prompt.trim() ? 'bg-ink text-paper hover:opacity-85' : 'bg-line text-muted'
            } disabled:opacity-60`}
          >
            {anyBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {prompt.length > MAX_PROMPT - 60 ? (
        <p className="mt-1 text-right text-[11px] font-bold tabular-nums text-muted">
          {fill(t('aiPromptLeft'), { n: MAX_PROMPT - prompt.length })}
        </p>
      ) : null}
      {err ? <p className="mt-2 text-xs font-bold text-[#9F2F2D] dark:text-[#F2A8A8]">{err}</p> : null}

      {/* Empty state: a few prompts to tap. */}
      {drafts.length === 0 && !prompt ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-muted">{t('aiTry')}</span>
          {EXAMPLES.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                onPrompt(t(k));
                boxRef.current?.focus();
              }}
              className="rounded-full border border-[#E3D9FA] bg-white/70 px-3 py-1 text-left text-[11px] font-bold text-soft transition hover:text-ink dark:border-white/10 dark:bg-white/5"
            >
              {t(k)}
            </button>
          ))}
        </div>
      ) : null}

      {/* Results */}
      {drafts.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-extrabold text-soft">
              {drafts.length === 1 ? t('aiResult') : fill(t('aiNDrafts'), { n: drafts.length })}
            </p>
            <span className="flex-1" />
            {drafts.length > 1 ? (
              <button
                type="button"
                onClick={run}
                disabled={anyBusy}
                className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-[11px] font-bold text-muted transition hover:text-ink disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                {t('aiRegenAll')}
              </button>
            ) : null}
          </div>

          {drafts.map((d) => {
            const active = d.variants[d.tab];
            const isThreadView = d.thread && (active?.posts.length ?? 0) > 1;
            const limit = capFor(active?.platform ?? destinations[0], d.thread);
            const hasCopy = Boolean(active?.posts.some((p) => p.trim()));
            const title = isThreadView
              ? fill(t('aiNThread'), { n: active?.posts.length ?? 0 })
              : d.total > 1
                ? fill(t('aiPostN'), { n: d.index + 1 })
                : t('aiCaption');
            return (
              <article
                key={d.id}
                aria-busy={d.busy}
                className="rounded-2xl border border-[#E3D9FA] bg-white/70 p-3 dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <p className="text-xs font-extrabold text-[#5B3DF0] dark:text-[#B9A6F7]">{title}</p>
                  <span className="flex-1" />
                  {hasCopy ? (
                    <Chip
                      align="right"
                      label={
                        <>
                          <Wand2 className="h-3 w-3" aria-hidden="true" />
                          {t('aiRefine')}
                        </>
                      }
                      open={menu === `refine-${d.id}`}
                      onOpen={() => toggleMenu(`refine-${d.id}`)}
                    >
                      {REFINEMENTS.map(([op, key]) => (
                        <MenuRow key={op} on={false} onClick={() => void refine(d, op)}>
                          {t(key)}
                        </MenuRow>
                      ))}
                    </Chip>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => regenerateOne(d)}
                    disabled={d.busy}
                    aria-label={t('aiRegenOne')}
                    title={t('aiRegenOne')}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-paper text-muted transition hover:text-ink disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${d.busy ? 'animate-spin' : ''}`} aria-hidden="true" />
                  </button>
                </div>

                {d.variants.length > 1 ? (
                  <SegmentedPills
                    ariaLabel={t('aiChannelDrafts')}
                    role="tablist"
                    className="mt-2"
                    trackClassName="flex-wrap overflow-visible rounded-2xl"
                    size="sm"
                    value={d.tab}
                    onChange={(tab) => patch(d.id, { tab })}
                    options={d.variants.map((v, i) => ({
                      value: i,
                      label: (
                        <>
                          {v.platform === 'any' ? null : <PlatformGlyph id={v.platform} />}
                          {labelOf(v.platform)}
                        </>
                      ),
                    }))}
                  />
                ) : null}

                {d.busy && !hasCopy ? (
                  <div className="mt-2 space-y-1.5" aria-label={t('aiWriting')}>
                    <div className="h-3 w-11/12 animate-pulse rounded bg-[#E3D9FA] dark:bg-white/10" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-[#E3D9FA] dark:bg-white/10" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-[#E3D9FA] dark:bg-white/10" />
                  </div>
                ) : null}

                {active ? (
                  <div className={`mt-2 space-y-2 ${d.busy ? 'opacity-60' : ''}`}>
                    {active.posts.map((seg, i) => {
                      const over = seg.length > limit;
                      const tooShort = isThreadView && seg.length < THREAD_POST_MIN;
                      const what = active.posts.length > 1 ? fill(t('aiPostWord'), { n: i + 1 }) : t('aiCaption');
                      return (
                        <div key={i}>
                          {active.posts.length > 1 ? (
                            <p className="px-0.5 text-[11px] font-bold text-muted">{fill(t('aiPostN'), { n: i + 1 })}</p>
                          ) : null}
                          <textarea
                            value={seg}
                            onChange={(e) => setPost(d, i, e.target.value)}
                            disabled={d.busy}
                            rows={Math.min(8, Math.max(3, Math.ceil(seg.length / 70)))}
                            aria-label={fill(t('aiEditPost'), { what })}
                            className="mt-0.5 w-full resize-y rounded-lg border border-line-soft bg-paper px-2.5 py-2 text-xs leading-relaxed text-ink focus:outline-none focus:ring-2 focus:ring-[#5B3DF0]/40"
                          />
                          <p className={`text-right text-[11px] font-bold tabular-nums ${over ? 'text-[#9F2F2D] dark:text-[#F2A8A8]' : tooShort ? 'text-[#B98A1C] dark:text-[#E8C162]' : 'text-faint'}`}>
                            {seg.length}/{limit}
                            {tooShort ? ` · ${fill(t('aiMin'), { n: THREAD_POST_MIN })}` : ''}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {active && hashtags && active.hashtags.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {active.hashtags.map((h) => (
                      <span key={h} className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent-ink">
                        #{h}
                      </span>
                    ))}
                  </div>
                ) : null}

                {d.err ? (
                  <p className="mt-2 text-xs font-bold text-[#9F2F2D] dark:text-[#F2A8A8]">{d.err}</p>
                ) : null}

                {hasCopy ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => apply(d)}
                      disabled={d.busy}
                      className="btn btn-primary !py-1.5 !text-xs"
                    >
                      {t('aiUse')}
                    </button>
                    {onSchedule ? (
                      <button
                        type="button"
                        onClick={() => apply(d, true)}
                        disabled={d.busy}
                        className="btn btn-ghost flex items-center gap-1.5 !py-1.5 !text-xs"
                      >
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('aiSchedule')}
                      </button>
                    ) : null}
                    {appliedId === d.id ? (
                      <span className="text-[11px] font-bold text-[#346538] dark:text-[#9BD49B]">{appliedNote}</span>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
