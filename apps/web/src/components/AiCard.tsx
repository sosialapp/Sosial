'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { generateSocial, rewritePosts, withHashtags, SOCIAL_PLATFORMS, THREAD_PLATFORM_IDS, THREAD_POST_MIN, capFor, platformLabel, type AiVariant, type RewriteOp } from '@/lib/ai';
import { STUDIO_STYLES, STUDIO_TONES, WRITER_LANGUAGES, styleSampleFor } from '@/lib/aiStudio';
import { providerMeta } from '@/lib/providers';

type EmojiMode = 'auto' | 'on' | 'off';
const EMOJI_OPTS: { id: EmojiMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'on', label: 'Some' },
  { id: 'off', label: 'None' },
];

const REFINEMENTS: [RewriteOp, string][] = [
  ['shorter', 'Shorter'],
  ['punchier', 'Punchier'],
  ['natural', 'More natural'],
  ['context', 'Add context'],
  ['tone', 'Change tone'],
  ['style', 'Change style'],
];

/** Destination pill — brand dot when the platform is a known provider. */
function PlatformGlyph({ id }: { id: string }) {
  const meta = providerMeta(id);
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden="true" />;
}

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
 * Write with AI — the mobile studio's behavior on web. The idea owns the
 * card; destinations are picked in the card; the result comes back as
 * editable per-channel drafts with counters and refine transforms, and only
 * "Use this caption/thread" hands anything to the composer.
 */
export default function AiCard({
  providers,
  thread,
  onThreadChange,
  parts,
  onPartsChange,
  onResult,
  appliedNote = 'Applied — edit freely.',
}: {
  /** Provider keys of the connected channels — preselects the destinations. */
  providers: string[];
  thread: boolean;
  onThreadChange: (v: boolean) => void;
  parts: number;
  onPartsChange: (n: number) => void;
  onResult: (bodies: string[]) => void;
  appliedNote?: string;
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

  /* --------------------------- destinations --------------------------- */
  const known = useMemo(
    () => providers.filter((p) => SOCIAL_PLATFORMS.some((s) => s.id === p)),
    [providers],
  );
  const [platforms, setPlatforms] = useState<string[]>(() => (known.length ? known : ['any']));

  // Threads only publish as chains on four channels — narrow like mobile.
  useMemo(() => {
    if (!thread) return;
    setPlatforms((prev) => {
      const kept = prev.filter((p) => THREAD_PLATFORM_IDS.includes(p));
      return kept.length ? kept : ['x'];
    });
  }, [thread]);

  const togglePlatform = (p: string) => {
    if (p === 'any') return setPlatforms(['any']);
    setPlatforms((prev) => {
      const next = prev.filter((x) => x !== 'any');
      const out = next.includes(p) ? next.filter((x) => x !== p) : [...next, p];
      return out.length ? out : thread ? ['x'] : ['any'];
    });
  };

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
    const t = topic.trim();
    if (!t) {
      setErr('Give the AI a rough thought to work with.');
      return;
    }
    setBusy(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const sb = createClient();
      const variants = await generateSocial(sb, {
        topic: t,
        platforms,
        thread,
        parts: thread ? parts : 1,
        tone,
        language,
        style,
        instructions: instructions.trim() || undefined,
        emoji,
        cta,
        hashtags,
      });
      setDraft(variants);
      setTab(0);
      setDirty(false);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'AI generation failed.');
    } finally {
      setBusy(false);
    }
  }

  function regenerate() {
    if (dirty && !window.confirm('Start over? You will lose your manual edits.')) return;
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
      setErr(e instanceof Error ? e.message : 'Could not rewrite — kept your original.');
    } finally {
      setBusy(false);
    }
  }

  function transform(op: RewriteOp) {
    if (dirty && !window.confirm('Rewrite this draft? The AI will replace your manual edits.')) return;
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

  const destChoices = thread
    ? SOCIAL_PLATFORMS.filter((p) => THREAD_PLATFORM_IDS.includes(p.id))
    : SOCIAL_PLATFORMS;
  const destCount = platforms.includes('any') ? 1 : platforms.length;

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
        placeholder="e.g. why I stopped chasing viral hacks and started posting one honest update a day…"
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
              onClick={() => onPartsChange(Math.max(3, parts - 1))}
              aria-label="Fewer posts"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-base font-bold leading-none text-soft shadow-sm transition hover:text-ink dark:bg-white/10"
            >
              −
            </button>
            <span className="min-w-7 text-center text-xs font-extrabold">{parts}</span>
            <button
              type="button"
              onClick={() => onPartsChange(Math.min(12, parts + 1))}
              aria-label="More posts"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-base font-bold leading-none text-soft shadow-sm transition hover:text-ink dark:bg-white/10"
            >
              +
            </button>
          </span>
        </div>
      ) : null}

      {/* Destination */}
      <p className="mt-4 text-xs font-bold text-soft">Post to{thread ? ' (thread channels)' : ''}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Destinations">
        {destChoices.map((p) => {
          const on = platforms.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePlatform(p.id)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                on
                  ? 'border-ink bg-ink text-paper'
                  : 'border-[#E3D9FA] bg-white/60 text-muted hover:text-ink dark:border-white/10 dark:bg-white/5'
              }`}
            >
              {p.id === 'any' ? null : <PlatformGlyph id={p.id} />}
              {p.label}
            </button>
          );
        })}
      </div>
      {destCount > 1 ? (
        <p className="mt-1 text-[11px] text-muted">Same facts everywhere — the wording adapts to each channel.</p>
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

      {/* Result — editable drafts, like the mobile sheet */}
      {err ? <p className="mt-2 text-xs font-bold text-[#9F2F2D] dark:text-[#F2A8A8]">{err}</p> : null}

      {draft.length > 0 && !busy ? (
        <div className="mt-3 rounded-2xl border border-[#E3D9FA] bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2">
            <Sparkles className={`h-4 w-4 ${hasCopy ? 'text-[#346538] dark:text-[#9BD49B]' : 'text-[#9F2F2D] dark:text-[#F2A8A8]'}`} aria-hidden="true" />
            <p className="text-sm font-extrabold">
              {isThreadView ? `${active?.posts.length ?? 0}-post thread` : 'Caption'}
            </p>
          </div>

          {draft.length > 1 ? (
            <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Channel drafts">
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
                      {active.posts.length > 1 ? `Post ${i + 1}` : 'Caption'}
                    </span>
                    <span className={`text-[11px] font-bold tabular-nums ${over ? 'text-[#9F2F2D] dark:text-[#F2A8A8]' : tooShort ? 'text-[#B98A1C] dark:text-[#E8C162]' : 'text-faint'}`}>
                      {seg.length}/{limit}{tooShort ? ` · min ${THREAD_POST_MIN}` : ''}
                    </span>
                  </div>
                  <textarea
                    value={seg}
                    onChange={(e) => setPost(i, e.target.value)}
                    rows={3}
                    aria-label={`Edit ${active.posts.length > 1 ? `post ${i + 1}` : 'caption'}`}
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
          <p className="mt-3 text-xs font-bold text-soft">Refine</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {REFINEMENTS.map(([op, label]) => (
              <button
                key={op}
                type="button"
                onClick={() => transform(op)}
                disabled={busy}
                className="rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] font-bold text-muted transition hover:text-ink disabled:opacity-50"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={regenerate}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] font-bold text-muted transition hover:text-ink disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Regenerate
            </button>
          </div>
        </div>
      ) : null}

      {busy ? <p className="mt-2 text-xs font-bold text-muted">Writing…</p> : null}

      {appliedAt ? <p className="mt-2 text-xs font-bold text-[#346538] dark:text-[#9BD49B]">{appliedNote}</p> : null}

      {/* Sticky CTA */}
      {draft.length > 0 && hasCopy && !busy ? (
        <button type="button" onClick={apply} className="btn btn-primary mt-3 w-full">
          {isThreadView ? `Use this thread (${active?.posts.length ?? 0})` : 'Use this caption'}
        </button>
      ) : (
        <button type="button" onClick={run} disabled={busy} className="btn btn-primary mt-3 w-full">
          {busy ? 'Writing…' : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Generate
            </>
          )}
        </button>
      )}
    </section>
  );
}
