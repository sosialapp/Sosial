'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BrandIcon } from '@/components/BrandIcon';
import ChannelAvatar, { channelAvatar } from '@/components/ChannelAvatar';
import DateTimePicker from '@/components/DateTimePicker';
import { providerMeta } from '@/lib/providers';
import { createChain, createPost, type ComposeMode } from '@/lib/posts';
import { createClient } from '@/lib/supabase/client';
import { generateCaptions, withHashtags } from '@/lib/ai';
import {
  STUDIO_STYLES,
  STUDIO_TONES,
  WRITER_LANGUAGES,
  styleSampleFor,
} from '@/lib/aiStudio';
import type { ConnectedChannel, ProviderKey, WorkspaceInfo } from '@/lib/types';

const EMOJIS = ['😀', '😍', '🔥', '🎉', '👏', '💡', '🚀', '❤️', '👀', '💪', '🌟', '😂', '🙌', '💯', '✨', '🎯', '📣', '💬', '🤝', '🌈', '☀️', '🎨'];

type EmojiMode = 'auto' | 'on' | 'off';
const EMOJI_OPTS: { id: EmojiMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'on', label: 'Some' },
  { id: 'off', label: 'None' },
];

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
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

/** Branch mark, same glyph family as the mobile app's thread icon. */
function BranchIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

interface MediaItem {
  file: File;
  kind: 'image' | 'video';
  url: string;
}

/**
 * Create hub post tab: composer card (channel pills, inbox media, thread
 * link, dashboard-style mode row) + AI studio card bound to the same
 * channels, thread and destination state.
 */
export default function CreatePost({
  channels,
  workspaceId,
  userId,
  role,
  initialTitle = '',
  initialBody = '',
  initialFiles = [],
}: {
  channels: ConnectedChannel[];
  workspaceId: string;
  userId: string;
  role: WorkspaceInfo['role'];
  initialTitle?: string;
  initialBody?: string;
  initialFiles?: File[];
}) {
  const router = useRouter();
  const ready = useMemo(() => channels.filter((c) => c.status === 'connected'), [channels]);

  /* ------------------------------ composer ------------------------------ */
  const [body, setBody] = useState(initialBody || initialTitle);
  const [picked, setPicked] = useState<string[]>(() => ready.map((c) => c.id));
  const [files, setFiles] = useState<MediaItem[]>(() =>
    initialFiles.map((file) => ({
      file,
      kind: (file.type.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
      url: URL.createObjectURL(file),
    })),
  );
  const [thread, setThread] = useState(false);
  const [extras, setExtras] = useState<string[]>(['']);
  const [gap, setGap] = useState(10);
  const [mode, setMode] = useState<'now' | 'schedule'>('schedule');
  const [whenIso, setWhenIso] = useState<string | null>(null);
  const [tz, setTz] = useState(deviceZone);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileAccept = useRef('image/*,video/*');

  /* -------------------------------- AI -------------------------------- */
  const [aiTopic, setAiTopic] = useState('');
  const [language, setLanguage] = useState('auto');
  const [langOpen, setLangOpen] = useState(false);
  const [langQuery, setLangQuery] = useState('');
  const [tone, setTone] = useState('auto');
  const [style, setStyle] = useState('auto');
  const [styleOpen, setStyleOpen] = useState(false);
  const [parts, setParts] = useState(3);
  const [hashtags, setHashtags] = useState(true);
  const [emoji, setEmoji] = useState<EmojiMode>('auto');
  const [cta, setCta] = useState(true);
  const [instructions, setInstructions] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [appliedAt, setAppliedAt] = useState<number | null>(null);

  const chosenProviders = useMemo(
    () => Array.from(new Set(ready.filter((c) => picked.includes(c.id)).map((c) => c.provider))),
    [ready, picked],
  );
  const limit = useMemo(() => {
    const ls = ready.filter((c) => picked.includes(c.id)).map((c) => providerMeta(c.provider).limit);
    return ls.length ? Math.min(...ls) : 2200;
  }, [ready, picked]);
  const over = body.length > limit;

  const langName = (id: string) => WRITER_LANGUAGES.find((l) => l.id === id)?.label ?? id;
  const langMatches = useMemo(() => {
    const q = langQuery.trim().toLowerCase();
    const list = q
      ? WRITER_LANGUAGES.filter((l) => l.id.toLowerCase().includes(q) || l.label.toLowerCase().includes(q))
      : WRITER_LANGUAGES;
    return list.slice(0, 60);
  }, [langQuery]);

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function setThreadMode(v: boolean) {
    setThread(v);
    if (v) {
      setExtras((prev) => {
        const need = Math.max(0, parts - 1);
        if (prev.length >= need) return prev.slice(0, Math.max(1, need));
        return [...prev, ...Array<string>(Math.max(1, need) - prev.length).fill('')];
      });
    }
  }

  function setPartsCount(n: number) {
    const clamped = Math.max(2, Math.min(8, n));
    setParts(clamped);
    setExtras((prev) => {
      const need = clamped - 1;
      if (prev.length >= need) return prev.slice(0, need);
      return [...prev, ...Array<string>(need - prev.length).fill('')];
    });
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).map((file) => ({
      file,
      kind: (file.type.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
      url: URL.createObjectURL(file),
    }));
    setFiles((prev) => {
      for (const g of prev) URL.revokeObjectURL(g.url);
      return [...prev, ...next].slice(0, 10);
    });
  }

  function removeFile(i: number) {
    setFiles((prev) => {
      const next = [...prev];
      const [gone] = next.splice(i, 1);
      if (gone) URL.revokeObjectURL(gone.url);
      return next;
    });
  }

  function pickMedia(kind: 'photo' | 'video') {
    fileAccept.current = kind === 'photo' ? 'image/*' : 'video/*';
    fileRef.current?.click();
  }

  function insertAtCursor(text: string) {
    const el = taRef.current;
    if (!el) {
      setBody((b) => b + text);
      return;
    }
    const { selectionStart: s, selectionEnd: e, value } = el;
    const next = `${value.slice(0, s)}${text}${value.slice(e)}`;
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + text.length, s + text.length);
    });
  }

  function wrap(before: string, after: string = before) {
    const el = taRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const next = `${value.slice(0, s)}${before}${value.slice(s, e)}${after}${value.slice(e)}`;
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, e + before.length);
    });
  }

  async function runAi() {
    setAiErr(null);
    setAppliedAt(null);
    const t = aiTopic.trim();
    if (!t) {
      setAiErr('Describe the topic first.');
      return;
    }
    if (!chosenProviders.length) {
      setAiErr('Pick at least one channel below — the AI sizes copy to the strictest one.');
      return;
    }
    const count = thread ? parts : 1;
    setAiBusy(true);
    try {
      const sb = createClient();
      const segs = await generateCaptions(sb, {
        topic: t,
        providers: chosenProviders,
        count,
        tone,
        language,
        style,
        instructions: instructions.trim() || undefined,
        emoji,
        cta,
      });
      const bodies = segs.map((s) => (hashtags ? withHashtags(s.caption, s.hashtags) : s.caption));
      setBody(bodies[0] ?? '');
      setExtras(bodies.length > 1 ? bodies.slice(1) : thread ? [''] : []);
      setAppliedAt(Date.now());
    } catch (e2) {
      setAiErr(e2 instanceof Error ? e2.message : 'AI generation failed.');
    } finally {
      setAiBusy(false);
    }
  }

  async function submit(e: FormEvent, submitMode: ComposeMode) {
    e.preventDefault();
    setErr(null);
    const chosen = ready.filter((c) => picked.includes(c.id));
    if (!chosen.length) {
      setErr('Pick at least one channel.');
      return;
    }
    if (submitMode === 'schedule' && !whenIso) {
      setErr('Choose a date and time first.');
      return;
    }
    const text = body.trim();
    const liveParts = thread ? [text, ...extras.map((s) => s.trim())].filter(Boolean) : [text].filter(Boolean);
    if (liveParts.length === 0 && files.length === 0) {
      setErr('Add a caption or some media first.');
      return;
    }
    if (over) {
      setErr(`Caption is ${body.length - limit} characters over the strictest channel limit.`);
      return;
    }
    setBusy(true);
    try {
      const sb = createClient();
      const media = files.map(({ file, kind }) => ({ file, kind }));
      if (!thread) {
        await createPost(sb, {
          workspaceId,
          userId,
          role,
          title: text.split('\n')[0].slice(0, 60),
          body: text,
          mode: submitMode,
          scheduleIso: submitMode === 'schedule' ? whenIso : null,
          channels: chosen,
          files: media,
          timezone: tz,
        });
      } else {
        const payload = liveParts.map((b, k) => ({ body: b, files: k === 0 ? media : [] }));
        await createChain(sb, {
          workspaceId,
          userId,
          role,
          segments: payload.length ? payload : [{ body: '', files: media }],
          mode: submitMode,
          startIso: submitMode === 'schedule' ? whenIso : null,
          gapMinutes: Math.max(0, Math.min(1440, gap || 0)),
          channels: chosen,
        });
      }
      router.push('/queue');
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not save the post.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => submit(e, mode)}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {/* Left: composer */}
        <div className="min-w-0 xl:col-span-3">
          <section className="card p-5" aria-label="Create your post">
            <p className="font-display text-base font-extrabold tracking-tight">Create your post</p>

            {/* Channel pills — dashboard style */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Channels">
              {ready.length === 0 ? (
                <p className="text-xs text-muted">
                  Nothing connected.{' '}
                  <Link href="/channels" className="font-bold text-ink hover:underline">
                    Connect a channel
                  </Link>
                </p>
              ) : (
                ready.map((c) => {
                  const on = picked.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.id)}
                      aria-pressed={on}
                      title={c.display_name ?? providerMeta(c.provider).label}
                      className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 text-xs font-bold transition ${
                        on
                          ? 'border-ink bg-paper text-ink'
                          : 'border-line bg-paper text-faint opacity-60 hover:opacity-100'
                      }`}
                    >
                      <ChannelAvatar provider={c.provider} avatar={channelAvatar(c.metadata)} size={24} />
                      {providerMeta(c.provider).label}
                    </button>
                  );
                })
              )}
            </div>

            {/* Text box with media + toolbar inside */}
            <div className="mt-3 rounded-xl border border-line bg-paper focus-within:border-ink/40">
              <textarea
                ref={taRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What's on your mind?"
                rows={5}
                aria-label="Post text"
                className="min-h-[128px] w-full resize-y bg-transparent px-3 pt-2.5 text-sm text-ink placeholder:text-faint focus:outline-none"
              />
              {/* Inline attachments */}
              {files.length > 0 ? (
                <div className="flex gap-1.5 overflow-x-auto px-3 pb-1">
                  {files.map((f, i) => (
                    <span key={i} className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-paper-dim">
                      {f.kind === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <video src={f.url} muted playsInline className="h-full w-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        aria-label="Remove media"
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] leading-none text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              {/* Toolbar row */}
              <div className="flex items-center gap-0.5 border-t border-line-soft px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => pickMedia('photo')}
                  aria-label="Add photo"
                  title="Add photo"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-paper-dim hover:text-ink"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2.5" y="2.5" width="15" height="15" rx="2.5" />
                    <circle cx="7" cy="7" r="1.4" />
                    <path d="m4.5 15.5 4-4 2.5 2.5 2-2 2.5 2.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => pickMedia('video')}
                  aria-label="Add video"
                  title="Add video"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-paper-dim hover:text-ink"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="4" width="12.5" height="12" rx="2.5" />
                    <path d="m14.5 10 3.5-2.5v5L14.5 10Z" />
                  </svg>
                </button>
                <span className="mx-1 h-4 w-px bg-line-soft" aria-hidden="true" />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setEmojiOpen((v) => !v)}
                    aria-label="Insert emoji"
                    aria-expanded={emojiOpen}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-paper-dim hover:text-ink"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
                      <circle cx="10" cy="10" r="6.5" />
                      <path d="M7.5 8.2h.01M12.5 8.2h.01M7.5 12c.7.8 1.6 1.2 2.5 1.2s1.8-.4 2.5-1.2" />
                    </svg>
                  </button>
                  {emojiOpen ? (
                    <div className="absolute bottom-9 left-0 z-30 grid w-52 grid-cols-6 gap-0.5 rounded-xl border border-line bg-card p-2 shadow-[0_18px_40px_-16px_rgba(25,21,18,0.4)]" role="menu" aria-label="Emojis">
                      {EMOJIS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => {
                            insertAtCursor(em);
                            setEmojiOpen(false);
                          }}
                          className="rounded-lg p-1.5 text-lg transition hover:bg-paper-dim"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => wrap('**')}
                  aria-label="Bold"
                  title="Bold"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-extrabold text-muted transition hover:bg-paper-dim hover:text-ink"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => wrap('_')}
                  aria-label="Italic"
                  title="Italic"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-extrabold italic text-muted transition hover:bg-paper-dim hover:text-ink"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => wrap('[', '](https://)')}
                  aria-label="Insert link"
                  title="Insert link"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-paper-dim hover:text-ink"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8.2 11.8a3.2 3.2 0 0 0 4.5 0l2.3-2.3a3.2 3.2 0 0 0-4.5-4.5l-1 1" />
                    <path d="M11.8 8.2a3.2 3.2 0 0 0-4.5 0L5 10.5a3.2 3.2 0 0 0 4.5 4.5l1-1" />
                  </svg>
                </button>
                <span className="flex-1" />
                <span className={`text-[11px] ${over ? 'font-bold text-[#9F2F2D]' : 'text-faint'}`}>
                  {body.length} / {limit}
                </span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={fileAccept.current}
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Thread parts */}
            {thread ? (
              <div className="mt-3 space-y-2">
                {extras.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <textarea
                      value={s}
                      onChange={(e) =>
                        setExtras((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                      }
                      placeholder={`Part ${i + 2}…`}
                      rows={2}
                      aria-label={`Thread part ${i + 2}`}
                      className="field min-h-[56px] flex-1 resize-y"
                    />
                    <button
                      type="button"
                      onClick={() => setExtras((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`Remove part ${i + 2}`}
                      className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-paper-dim hover:text-ink"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3">
                  {extras.length + 1 < 8 ? (
                    <button
                      type="button"
                      onClick={() => setExtras((prev) => [...prev, ''])}
                      className="text-xs font-bold text-ink hover:underline"
                    >
                      + Add part
                    </button>
                  ) : null}
                  <label className="flex items-center gap-1.5 text-[11px] text-muted">
                    Minutes between posts
                    <input
                      type="number"
                      min={0}
                      max={1440}
                      value={gap}
                      onChange={(e) => setGap(Number(e.target.value))}
                      aria-label="Minutes between posts"
                      className="field !w-16 !py-1 text-xs"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {/* Post as thread — mobile style */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setThreadMode(!thread)}
                aria-pressed={thread}
                className="flex items-center gap-1.5 text-xs font-bold text-accent-ink transition hover:opacity-80"
              >
                <BranchIcon />
                {thread ? 'Turn off thread' : 'Post as thread'}
              </button>
            </div>

            {err ? <p className="mt-3 text-xs font-bold text-[#9F2F2D]">{err}</p> : null}

            {/* Mode + action — dashboard style */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex rounded-full border border-line bg-paper p-1" role="group" aria-label="Post mode">
                {(['now', 'schedule'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                      mode === m ? 'bg-ink text-paper shadow-sm' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {m === 'now' ? 'Post now' : 'Schedule'}
                  </button>
                ))}
              </div>
              <span className="flex-1" />
              <button
                type="button"
                onClick={(e) => submit(e, 'draft')}
                disabled={busy}
                className="text-xs font-bold text-muted transition hover:text-ink disabled:opacity-50"
              >
                Save draft
              </button>
              <button type="submit" disabled={busy} className="btn btn-primary !py-1.5 !text-xs">
                {busy ? (
                  'Sending…'
                ) : mode === 'now' ? (
                  'Post now'
                ) : (
                  'Schedule post'
                )}
              </button>
            </div>
            {mode === 'schedule' ? (
              <div className="mt-2.5">
                <DateTimePicker
                  value={whenIso}
                  timezone={tz}
                  onChange={setWhenIso}
                  onTimezoneChange={setTz}
                />
              </div>
            ) : null}
          </section>
        </div>

        {/* Right rail: AI studio */}
        <div className="min-w-0 xl:col-span-2">
          <section
            aria-label="AI Generate"
            className="rounded-3xl border border-[#D9CCFA] bg-[#F5F0FF] p-5 dark:border-[#5B3DF0]/40 dark:bg-[#17122B]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 20 20" className="h-5 w-5 text-[#5B3DF0] dark:text-[#B9A6F7]" fill="currentColor" aria-hidden="true">
                  <path d="M10 1.5 11.8 8.2 18.5 10 11.8 11.8 10 18.5 8.2 11.8 1.5 10 8.2 8.2 10 1.5Z" />
                </svg>
                <div>
                  <p className="font-display text-base font-extrabold tracking-tight">AI Generate</p>
                  <p className="text-[11px] text-muted">Turn your ideas into engaging posts with AI.</p>
                </div>
              </div>
              <Link
                href="/ai-assistant"
                aria-label="About the AI assistant"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-white hover:text-ink dark:hover:bg-white/10"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m7.5 4.5 6 5.5-6 5.5" />
                </svg>
              </Link>
            </div>

            {/* Idea */}
            <textarea
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="e.g. Create a catchy Instagram caption about building better habits for a healthier life…"
              rows={3}
              aria-label="Your idea"
              className="mt-3 min-h-[76px] w-full resize-y rounded-xl border border-[#E3D9FA] bg-white/80 px-3 py-2.5 text-xs leading-relaxed text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-[#5B3DF0]/40 dark:border-white/10 dark:bg-white/5 dark:text-paper"
            />
            <p className="mt-1 text-[11px] text-faint">Rough thoughts are enough — a phrase works.</p>

            {/* Language */}
            <p className="mt-4 text-xs font-bold text-soft">Language</p>
            <div className="relative mt-1.5">
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                aria-expanded={langOpen}
                className="flex w-full items-center gap-2 rounded-xl border border-[#E3D9FA] bg-white/80 px-3 py-2 text-xs font-bold text-ink dark:border-white/10 dark:bg-white/5 dark:text-paper"
              >
                <span className="flex-1 truncate text-left">
                  {language === 'auto' ? 'Auto — match my idea' : langName(language)}
                </span>
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={langOpen ? 'm4.5 12.5 5.5-6 5.5 6' : 'm7.5 4.5 6 5.5-6 5.5'} transform={langOpen ? undefined : 'rotate(90 10 10)'} />
                </svg>
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
                        {l.label !== l.id ? <span className="text-[11px] font-medium text-faint">{l.id}</span> : null}
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
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={styleOpen ? 'm4.5 12.5 5.5-6 5.5 6' : 'm7.5 4.5 6 5.5-6 5.5'} transform={styleOpen ? undefined : 'rotate(90 10 10)'} />
              </svg>
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
                        <span className="text-[11px] text-faint">{s.hint}</span>
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
                    onClick={() => setThreadMode(f === 'thread')}
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
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPartsCount(parts - 1)}
                    aria-label="Fewer posts"
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-sm font-bold text-soft transition hover:border-ink hover:text-ink"
                  >
                    −
                  </button>
                  <span className="min-w-6 text-center text-xs font-extrabold">{parts}</span>
                  <button
                    type="button"
                    onClick={() => setPartsCount(parts + 1)}
                    aria-label="More posts"
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-sm font-bold text-soft transition hover:border-ink hover:text-ink"
                  >
                    +
                  </button>
                </span>
              </div>
            ) : null}

            {/* Destination — same channels as the composer */}
            <p className="mt-4 text-xs font-bold text-soft">Post to</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Destination channels">
              {ready.length === 0 ? (
                <Link href="/channels" className="text-xs font-bold text-[#2f7cf6] hover:underline">
                  Connect a channel first
                </Link>
              ) : (
                ready.map((c) => {
                  const on = picked.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.id)}
                      aria-pressed={on}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition ${
                        on
                          ? 'border-[#5B3DF0] bg-white text-[#5B3DF0] dark:bg-white/10'
                          : 'border-[#E3D9FA] bg-white/60 text-muted hover:text-ink dark:border-white/10 dark:bg-white/5'
                      }`}
                    >
                      <BrandIcon provider={c.provider as ProviderKey} className="h-4 w-4" />
                      {providerMeta(c.provider).label}
                      {on ? <span aria-hidden="true">✓</span> : null}
                    </button>
                  );
                })
              )}
            </div>

            {/* Advanced */}
            <button
              type="button"
              onClick={() => setAdvanced((v) => !v)}
              aria-expanded={advanced}
              className="mt-4 flex w-full items-center gap-2 text-xs font-bold text-soft"
            >
              Advanced options
              <span className="flex-1" />
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={advanced ? 'm4.5 12.5 5.5-6 5.5 6' : 'm7.5 4.5 6 5.5-6 5.5'} transform={advanced ? undefined : 'rotate(90 10 10)'} />
              </svg>
            </button>
            {advanced ? (
              <div className="mt-1.5 space-y-3 rounded-xl border border-[#E3D9FA] bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="flex-1">
                    <span className="block text-xs font-bold">Add hashtags</span>
                    <span className="block text-[11px] text-faint">Kept separate from the copy</span>
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
                    <span className="block text-[11px] text-faint">Closes with an invitation, not a demand</span>
                  </span>
                  <Switch on={cta} onToggle={() => setCta((v) => !v)} label="Soft call-to-action" />
                </div>
                <div>
                  <p className="text-xs font-bold">Custom instructions <span className="font-medium text-faint">· optional</span></p>
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

            {aiErr ? <p className="mt-2 text-xs font-bold text-[#9F2F2D]">{aiErr}</p> : null}
            {appliedAt ? (
              <p className="mt-2 text-xs font-bold text-[#346538]">
                Applied to the composer — edit freely, then post.
              </p>
            ) : null}
            <button
              type="button"
              onClick={runAi}
              disabled={aiBusy}
              className="btn btn-primary mt-3 w-full"
            >
              {aiBusy ? (
                'Writing…'
              ) : appliedAt ? (
                'Regenerate'
              ) : (
                <>
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M10 1.5 11.8 8.2 18.5 10 11.8 11.8 10 18.5 8.2 11.8 1.5 10 8.2 8.2 10 1.5Z" />
                  </svg>
                  Generate
                </>
              )}
            </button>
          </section>
        </div>
      </div>
    </form>
  );
}
