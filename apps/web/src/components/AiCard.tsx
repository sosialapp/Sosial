'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, CalendarClock, Loader2, RefreshCw, SlidersHorizontal, Sparkles, Wand2 } from 'lucide-react';
import { generateSocial, rewritePosts, withHashtags, SOCIAL_PLATFORMS, THREAD_PLATFORM_IDS, THREAD_POST_MIN, capFor, platformLabel, type AiVariant, type RewriteOp } from '@/lib/ai';
import { MAX_PARTS, MAX_POSTS, MAX_PROMPT, MIN_PARTS, angleFor, creditsFor, readPromptHints } from '@/lib/aiPrompt';
import { STUDIO_TONES, WRITER_LANGUAGES } from '@/lib/aiStudio';
import { providerMeta } from '@/lib/providers';
import { useMessages } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n/locales';
import SegmentedPills from '@/components/ui/segmented-pills';
import { Chip, MenuRow, Switch, useMenuDismiss } from '@/components/AiPromptBits';

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
  useMenuDismiss(menu !== null, () => setMenu(null));

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
    <section aria-label={t('aiTitle')} className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink" aria-hidden="true">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-extrabold tracking-tight">{t('aiTitle')}</p>
          <p className="text-xs text-muted">{t('aiSub')}</p>
        </div>
      </div>

      {/* The prompt box: type, pick nothing, press send. A div, not a form:
          the card renders inside the composer's form. */}
      <div
        className="rounded-2xl border border-line bg-card transition focus-within:border-ink/35 focus-within:shadow-[0_0_0_3px_rgba(255,198,46,0.18)]"
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
          className="block max-h-72 min-h-[96px] w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-base leading-relaxed text-ink placeholder:text-faint focus:outline-none sm:text-[15px]"
        />
        <div className="flex items-start gap-1 border-t border-line-soft px-2 py-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
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
              <p className="px-3 pb-1 pt-1 text-xs font-semibold text-faint">{t('aiChannels')}</p>
              <div className="max-h-64 overflow-y-auto">
                {channelChoices.map((p) => (
                  <MenuRow key={p.id} on={destinations.includes(p.id)} onClick={() => togglePlatform(p.id)}>
                    {p.id === 'any' ? null : <PlatformGlyph id={p.id} />}
                    <span className="truncate">{labelOf(p.id)}</span>
                  </MenuRow>
                ))}
              </div>
              {thread ? <p className="px-3 pb-1 pt-2 text-xs text-faint">{t('aiThreadOnly')}</p> : null}
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
              <p className="px-1 pb-1.5 pt-3 text-xs font-semibold text-faint">{thread ? t('aiThreadLen') : t('aiHowMany')}</p>
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
                      className={`h-9 w-9 rounded-full text-sm font-bold transition ${on ? 'bg-ink text-paper' : 'bg-surface text-soft hover:text-ink'}`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </Chip>

            <Chip
              label={tone === 'auto' ? t('aiTone') : toneLabel(tone)}
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
              <p className="px-3 pb-1 pt-2 text-xs text-faint">{t('aiAutoHint')}</p>
            </Chip>

            <Chip
              label={<SlidersHorizontal className="h-3.5 w-3.5" aria-label={t('aiMoreOpts')} />}
              open={menu === 'more'}
              onOpen={() => toggleMenu('more')}
              active={moreActive}
              align="right"
            >
              <div className="space-y-3 p-1">
                <label className="block">
                  <span className="block text-sm font-semibold">{t('aiLanguage')}</span>
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
                  <span className="flex-1 text-sm font-semibold">{t('aiHashtags')}</span>
                  <Switch on={hashtags} onToggle={() => setHashtags((v) => !v)} label={t('aiHashtags')} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t('aiEmoji')}</p>
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
                  <span className="flex-1 text-sm font-semibold">{t('aiCta')}</span>
                  <Switch on={cta} onToggle={() => setCta((v) => !v)} label={t('aiCta')} />
                </div>
              </div>
            </Chip>

          </div>
          <button
            type="button"
            onClick={run}
            disabled={anyBusy}
            aria-label={t('aiGenerate')}
            title={`${t('aiEnterHint')} · ${fill(t('aiCreditsN'), { n: credits })}`}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${
              prompt.trim() ? 'bg-bolt text-on-accent hover:bg-bolt-deep' : 'bg-surface text-faint'
            } disabled:opacity-60`}
          >
            {anyBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {prompt.length > MAX_PROMPT - 60 ? (
        <p className="-mt-2 text-right text-xs tabular-nums text-faint">
          {fill(t('aiPromptLeft'), { n: MAX_PROMPT - prompt.length })}
        </p>
      ) : null}
      {err ? <p className="text-sm font-semibold text-[#9F2F2D] dark:text-[#F2A8A8]">{err}</p> : null}

      {/* Empty state: a few prompts to tap. */}
      {drafts.length === 0 && !prompt ? (
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
              <ArrowUp className="h-3.5 w-3.5 shrink-0 rotate-45 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      {/* Results */}
      {drafts.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <p className="text-sm font-bold text-ink">
              {drafts.length === 1 ? t('aiResult') : fill(t('aiNDrafts'), { n: drafts.length })}
            </p>
            <span className="flex-1" />
            {drafts.length > 1 ? (
              <button
                type="button"
                onClick={run}
                disabled={anyBusy}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold text-soft transition hover:bg-surface hover:text-ink disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
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
                className="rounded-2xl border border-line bg-card"
              >
                <div className="flex items-center gap-1 border-b border-line-soft py-1.5 pl-4 pr-2">
                  <p className="text-xs font-bold text-faint">{title}</p>
                  <span className="flex-1" />
                  {hasCopy ? (
                    <Chip
                      align="right"
                      side="bottom"
                      label={
                        <>
                          <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
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
                    className="grid h-8 w-8 place-items-center rounded-full text-soft transition hover:bg-surface hover:text-ink disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${d.busy ? 'animate-spin' : ''}`} aria-hidden="true" />
                  </button>
                </div>

                {d.variants.length > 1 ? (
                  <SegmentedPills
                    ariaLabel={t('aiChannelDrafts')}
                    role="tablist"
                    className="mx-4 mt-3"
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
                  <div className="space-y-2 px-4 py-4" aria-label={t('aiWriting')}>
                    <div className="h-3.5 w-11/12 animate-pulse rounded-full bg-surface" />
                    <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-surface" />
                    <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-surface" />
                  </div>
                ) : null}

                {active ? (
                  <div className={`divide-y divide-line-soft ${d.busy ? 'opacity-60' : ''}`}>
                    {active.posts.map((seg, i) => {
                      const over = seg.length > limit;
                      const tooShort = isThreadView && seg.length < THREAD_POST_MIN;
                      const what = active.posts.length > 1 ? fill(t('aiPostWord'), { n: i + 1 }) : t('aiCaption');
                      return (
                        <div key={i} className="px-4 pb-2 pt-3">
                          {active.posts.length > 1 ? (
                            <p className="text-xs font-semibold text-faint">{fill(t('aiPostN'), { n: i + 1 })}</p>
                          ) : null}
                          <textarea
                            value={seg}
                            onChange={(e) => setPost(d, i, e.target.value)}
                            disabled={d.busy}
                            rows={Math.min(8, Math.max(3, Math.ceil(seg.length / 70)))}
                            aria-label={fill(t('aiEditPost'), { what })}
                            className="block w-full resize-y bg-transparent text-[15px] leading-relaxed text-ink focus:outline-none"
                          />
                          <p className={`text-right text-xs tabular-nums ${over ? 'text-[#9F2F2D] dark:text-[#F2A8A8]' : tooShort ? 'text-[#B98A1C] dark:text-[#E8C162]' : 'text-faint'}`}>
                            {seg.length}/{limit}
                            {tooShort ? ` · ${fill(t('aiMin'), { n: THREAD_POST_MIN })}` : ''}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {active && hashtags && active.hashtags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                    {active.hashtags.map((h) => (
                      <span key={h} className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-soft">
                        #{h}
                      </span>
                    ))}
                  </div>
                ) : null}

                {d.err ? (
                  <p className="px-4 py-3 text-sm font-semibold text-[#9F2F2D] dark:text-[#F2A8A8]">{d.err}</p>
                ) : null}

                {hasCopy ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => apply(d)}
                      disabled={d.busy}
                      className="btn btn-bolt btn-sm"
                    >
                      {t('aiUse')}
                    </button>
                    {onSchedule ? (
                      <button
                        type="button"
                        onClick={() => apply(d, true)}
                        disabled={d.busy}
                        className="btn btn-ghost btn-sm"
                      >
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('aiSchedule')}
                      </button>
                    ) : null}
                    {appliedId === d.id ? (
                      <span className="text-xs font-semibold text-[#346538] dark:text-[#9BD49B]">{appliedNote}</span>
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
