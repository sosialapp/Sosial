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
import type { ConnectedChannel, ProviderKey, WorkspaceInfo } from '@/lib/types';

const EMOJIS = ['😀', '😍', '🔥', '🎉', '👏', '💡', '🚀', '❤️', '👀', '💪', '🌟', '😂', '🙌', '💯', '✨', '🎯', '📣', '💬', '🤝', '🌈', '☀️', '🎨'];

type AiKind = 'caption' | 'ideas' | 'threads' | 'script';
const AI_KINDS: { id: AiKind; label: string; tone: string }[] = [
  { id: 'caption', label: 'Caption', tone: 'auto' },
  { id: 'ideas', label: 'Ideas', tone: 'friendly' },
  { id: 'threads', label: 'Threads', tone: 'bold' },
  { id: 'script', label: 'Script', tone: 'professional' },
];

const WHEN_MODES: { id: ComposeMode; label: string }[] = [
  { id: 'draft', label: 'Save draft' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'now', label: 'Publish now' },
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

interface MediaItem {
  file: File;
  kind: 'image' | 'video';
  url: string;
}

/**
 * Create hub post tab, two-column layout: composer + media preview on the
 * left; AI generate, channels and schedule cards on the right.
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
  const [whenMode, setWhenMode] = useState<ComposeMode>('schedule');
  const [whenIso, setWhenIso] = useState<string | null>(null);
  const [tz, setTz] = useState(deviceZone);
  const [aiTopic, setAiTopic] = useState('');
  const [aiKind, setAiKind] = useState<AiKind>('caption');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiRef = useRef<HTMLTextAreaElement>(null);
  const aiCardRef = useRef<HTMLElement>(null);
  const whenRef = useRef<HTMLElement>(null);

  const chosenProviders = useMemo(
    () => Array.from(new Set(ready.filter((c) => picked.includes(c.id)).map((c) => c.provider))),
    [ready, picked],
  );
  const limit = useMemo(() => {
    const ls = ready.filter((c) => picked.includes(c.id)).map((c) => providerMeta(c.provider).limit);
    return ls.length ? Math.min(...ls) : 2200;
  }, [ready, picked]);
  const over = body.length > limit;

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAll() {
    setPicked((prev) => (prev.length === ready.length ? [] : ready.map((c) => c.id)));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).map((file) => ({
      file,
      kind: (file.type.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
      url: URL.createObjectURL(file),
    }));
    setFiles((prev) => {
      const merged = [...prev, ...next].slice(0, 10);
      for (const g of prev) URL.revokeObjectURL(g.url);
      return merged;
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

  function focusAi() {
    aiCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => aiRef.current?.focus(), 350);
  }

  async function runAi(e?: FormEvent) {
    e?.preventDefault();
    setAiErr(null);
    const t = aiTopic.trim();
    if (!t) {
      setAiErr('Describe the topic first.');
      return;
    }
    if (!chosenProviders.length) {
      setAiErr('Pick at least one channel. The AI sizes copy to the strictest one.');
      return;
    }
    const tone = AI_KINDS.find((k) => k.id === aiKind)?.tone ?? 'auto';
    const count = thread ? Math.max(1, [body, ...extras].filter((s) => s.trim()).length || 1) : 1;
    setAiBusy(true);
    try {
      const sb = createClient();
      const segs = await generateCaptions(sb, { topic: t, providers: chosenProviders, count, tone });
      if (thread) {
        const bodies = segs.map((s) => withHashtags(s.caption, s.hashtags));
        setBody(bodies[0] ?? '');
        setExtras(bodies.length > 1 ? bodies.slice(1) : ['']);
      } else {
        setBody(withHashtags(segs[0].caption, segs[0].hashtags));
      }
    } catch (e2) {
      setAiErr(e2 instanceof Error ? e2.message : 'AI generation failed.');
    } finally {
      setAiBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const chosen = ready.filter((c) => picked.includes(c.id));
    if (!chosen.length) {
      setErr('Pick at least one channel.');
      return;
    }
    if (whenMode === 'schedule' && !whenIso) {
      setErr('Choose a date and time first.');
      return;
    }
    const parts = thread ? [body, ...extras].map((s) => s.trim()) : [body.trim()];
    const live = parts.filter(Boolean);
    if (live.length === 0 && files.length === 0) {
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
      const text = body.trim();
      const media = files.map(({ file, kind }) => ({ file, kind }));
      if (!thread) {
        await createPost(sb, {
          workspaceId,
          userId,
          role,
          title: text.split('\n')[0].slice(0, 60),
          body: text,
          mode: whenMode,
          scheduleIso: whenMode === 'schedule' ? whenIso : null,
          channels: chosen,
          files: media,
          timezone: tz,
        });
      } else {
        const payload = live.map((b, k) => ({ body: b, files: k === 0 ? media : [] }));
        await createChain(sb, {
          workspaceId,
          userId,
          role,
          segments: payload.length ? payload : [{ body: '', files: media }],
          mode: whenMode,
          startIso: whenMode === 'schedule' ? whenIso : null,
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

  const firstFile = files[0] ?? null;

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {/* Left: composer + media preview */}
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-3">
          <section className="card p-5" aria-label="Composer">
            <p className="eyebrow">Composer</p>
            <p className="mt-1 font-display text-base font-extrabold tracking-tight">Create your post</p>

            {/* Channel row */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Selected channels">
              {Array.from(new Set(ready.filter((c) => picked.includes(c.id)).map((c) => c.provider))).map(
                (pv) => (
                  <BrandIcon key={pv} provider={pv as ProviderKey} className="h-7 w-7" />
                ),
              )}
              <Link
                href="/channels"
                aria-label="Add channel"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-line text-sm text-muted transition hover:border-ink hover:text-ink"
              >
                +
              </Link>
            </div>

            {/* Textarea + toolbar */}
            <div className="relative mt-3">
              <textarea
                ref={taRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What's on your mind?"
                rows={5}
                aria-label="Post text"
                className="field min-h-[128px] resize-y pb-7 pr-2"
              />
              <div className="absolute right-2 top-2 flex items-center gap-0.5" role="toolbar" aria-label="Formatting">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setEmojiOpen((v) => !v)}
                    aria-label="Insert emoji"
                    aria-expanded={emojiOpen}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-sm text-muted transition hover:bg-paper-dim hover:text-ink"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
                      <circle cx="10" cy="10" r="6.5" />
                      <path d="M7.5 8.2h.01M12.5 8.2h.01M7.5 12c.7.8 1.6 1.2 2.5 1.2s1.8-.4 2.5-1.2" />
                    </svg>
                  </button>
                  {emojiOpen ? (
                    <div className="absolute right-0 top-8 z-30 grid w-52 grid-cols-6 gap-0.5 rounded-xl border border-line bg-card p-2 shadow-[0_18px_40px_-16px_rgba(25,21,18,0.4)]" role="menu" aria-label="Emojis">
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
                {[
                  { label: 'Bold', char: 'B', fn: () => wrap('**') },
                  { label: 'Italic', char: 'I', italic: true, fn: () => wrap('_') },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={b.fn}
                    aria-label={b.label}
                    title={b.label}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-extrabold text-muted transition hover:bg-paper-dim hover:text-ink ${b.italic ? 'italic' : ''}`}
                  >
                    {b.char}
                  </button>
                ))}
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
              </div>
              <span className={`pointer-events-none absolute bottom-2 left-3 text-[11px] ${over ? 'font-bold text-[#9F2F2D]' : 'text-faint'}`}>
                {body.length} / {limit}
              </span>
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
                {extras.length + 1 < 8 ? (
                  <button
                    type="button"
                    onClick={() => setExtras((prev) => [...prev, ''])}
                    className="text-xs font-bold text-ink hover:underline"
                  >
                    + Add part
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* Media row */}
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-line p-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper-dim text-muted">
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2.5" y="2.5" width="15" height="15" rx="2.5" />
                    <circle cx="7" cy="7" r="1.4" />
                    <path d="m4.5 15.5 4-4 2.5 2.5 2-2 2.5 2.5" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold">Add photos or video</span>
                  <span className="block text-[11px] text-faint">Up to 10 files • Max 10MB each</span>
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                {files.slice(0, 2).map((f, i) => (
                  <span key={i} className="relative block h-12 w-12 overflow-hidden rounded-lg bg-paper-dim">
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
                      className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Add media"
                  className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-line text-lg text-muted transition hover:border-ink hover:text-ink"
                >
                  +
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Thread + AI + schedule shortcut */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft">
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6.5h9.5a2.5 2.5 0 0 1 0 5H7" />
                  <path d="m10 4 2.5 2.5L10 9" />
                  <path d="M16 13.5H6.5a2.5 2.5 0 0 0 0 5H13" />
                  <path d="m10 16-2.5-2.5L10 11" />
                </svg>
                Thread mode
                <Switch on={thread} onToggle={() => setThread((v) => !v)} label="Thread mode" />
              </label>
              <button
                type="button"
                onClick={focusAi}
                className="flex items-center gap-1.5 rounded-full border border-[#C9B8F5] bg-[#F3EEFF] px-3 py-1.5 text-xs font-bold text-[#5B3DF0] transition hover:bg-[#EBE2FF] dark:border-[#5B3DF0]/50 dark:bg-[#5B3DF0]/15 dark:text-[#B9A6F7]"
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                  <path d="M10 1.5 11.8 8.2 18.5 10 11.8 11.8 10 18.5 8.2 11.8 1.5 10 8.2 8.2 10 1.5Z" />
                </svg>
                AI Generate
              </button>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => {
                  setWhenMode('schedule');
                  whenRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-soft transition hover:border-ink hover:text-ink"
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
                  <path d="M3 8.5h14M7 2.8v3M13 2.8v3" />
                </svg>
                Schedule
              </button>
            </div>

            {err ? <p className="mt-3 text-xs font-bold text-[#9F2F2D]">{err}</p> : null}

            <div className="mt-3 flex justify-end">
              <button type="submit" disabled={busy} className="btn btn-primary !px-6">
                {busy ? (
                  'Posting…'
                ) : (
                  <>
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3.5 10 17 3.5 13.5 16.5 9 11.5 3.5 10Z" />
                    </svg>
                    Post
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Media preview */}
          <section className="card p-5" aria-label="Media preview">
            <p className="font-display text-sm font-extrabold tracking-tight">Media preview</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex min-h-[180px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-paper px-4 py-8 text-center transition hover:border-ink"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-paper-dim text-muted">
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2.5" y="2.5" width="15" height="15" rx="2.5" />
                    <circle cx="7" cy="7" r="1.4" />
                    <path d="m4.5 15.5 4-4 2.5 2.5 2-2 2.5 2.5" />
                  </svg>
                </span>
                <span className="text-xs font-bold">Add photos or video</span>
                <span className="text-[11px] text-faint">Up to 10 files • Max 10MB each</span>
              </button>
              <div className="flex min-h-[180px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-paper-dim px-4 py-8 text-center">
                {firstFile ? (
                  firstFile.kind === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={firstFile.url} alt="Media preview" className="max-h-44 w-full rounded-lg object-cover" />
                  ) : (
                    <video src={firstFile.url} muted playsInline controls className="max-h-44 w-full rounded-lg" />
                  )
                ) : (
                  <>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-faint">
                      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 15.5 8.5 10l3 3 2-2 3.5 3.5" />
                        <path d="M3 3.5h14v13H3z" />
                      </svg>
                    </span>
                    <span className="text-xs font-bold text-soft">Your media will appear here</span>
                    <span className="text-[11px] text-faint">Add an image or video to see a preview</span>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right rail */}
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          {/* AI Generate */}
          <section
            ref={aiCardRef}
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
            <textarea
              ref={aiRef}
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="e.g. Create a catchy Instagram caption about building better habits for a healthier life…"
              rows={3}
              aria-label="AI topic"
              className="mt-3 min-h-[76px] w-full resize-y rounded-xl border border-[#E3D9FA] bg-white/80 px-3 py-2.5 text-xs leading-relaxed text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-[#5B3DF0]/40 dark:border-white/10 dark:bg-white/5 dark:text-paper"
            />
            {aiErr ? <p className="mt-2 text-xs font-bold text-[#9F2F2D]">{aiErr}</p> : null}
            <div className="mt-2.5 flex items-center gap-1.5">
              <div className="flex flex-1 flex-wrap gap-1.5" role="group" aria-label="AI output type">
                {AI_KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setAiKind(k.id)}
                    aria-pressed={aiKind === k.id}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                      aiKind === k.id
                        ? 'border-[#5B3DF0] bg-white text-[#5B3DF0] dark:bg-white/10'
                        : 'border-[#E3D9FA] bg-white/60 text-muted hover:text-ink dark:border-white/10 dark:bg-white/5'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => runAi()}
                disabled={aiBusy}
                aria-label="Generate with AI"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E3D9FA] bg-white/60 text-ink transition hover:border-[#5B3DF0] hover:text-[#5B3DF0] dark:border-white/10 dark:bg-white/5 dark:text-paper"
              >
                {aiBusy ? (
                  <span className="text-xs">…</span>
                ) : (
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3.5 10h13M13 5.5 17.5 10 13 14.5" />
                  </svg>
                )}
              </button>
            </div>
          </section>

          {/* Channels */}
          <section className="card p-5" aria-label="Channels">
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-extrabold tracking-tight">Channels</p>
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-bold text-[#2f7cf6] hover:underline"
              >
                {picked.length === ready.length && ready.length > 0 ? 'Clear all' : 'Select all'}
              </button>
            </div>
            {ready.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Nothing connected.{' '}
                <Link href="/channels" className="font-bold text-ink hover:underline">
                  Connect a channel
                </Link>
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-line-soft">
                {ready.map((c) => {
                  const on = picked.includes(c.id);
                  return (
                    <li key={c.id} className="flex items-center gap-3 py-2.5">
                      <ChannelAvatar provider={c.provider} avatar={channelAvatar(c.metadata)} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">
                          {c.display_name ?? providerMeta(c.provider).label}
                        </span>
                        <span className="block truncate text-[11px] text-faint">
                          {c.handle ? `@${c.handle}` : providerMeta(c.provider).label}
                        </span>
                      </span>
                      <Switch on={on} onToggle={() => toggle(c.id)} label={providerMeta(c.provider).label} />
                      <Link
                        href="/channels"
                        aria-label={`${providerMeta(c.provider).label} settings`}
                        className="text-faint transition hover:text-ink"
                      >
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="m7.5 4.5 6 5.5-6 5.5" />
                        </svg>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* When */}
          <section ref={whenRef} className="card scroll-mt-24 p-5" aria-label="When">
            <p className="font-display text-base font-extrabold tracking-tight">When</p>
            <div className="mt-3 grid grid-cols-3 gap-1.5" role="group" aria-label="Publish mode">
              {WHEN_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setWhenMode(m.id)}
                  aria-pressed={whenMode === m.id}
                  className={`rounded-full px-2 py-2 text-[11px] font-bold transition ${
                    whenMode === m.id ? 'bg-accent text-ink shadow-sm' : 'bg-paper-dim text-muted hover:text-ink'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {whenMode === 'schedule' ? (
              <>
                <p className="mt-4 text-xs font-bold text-soft">Date {'&'} time</p>
                <div className="mt-1.5">
                  <DateTimePicker
                    value={whenIso}
                    timezone={tz}
                    onChange={setWhenIso}
                    onTimezoneChange={setTz}
                  />
                </div>
                <p className="mt-4 text-xs font-bold text-soft">Minutes between posts</p>
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={gap}
                  disabled={!thread}
                  onChange={(e) => setGap(Number(e.target.value))}
                  aria-label="Minutes between posts"
                  title={thread ? 'Gap between thread parts' : 'Turn on Thread mode to stagger parts'}
                  className="field mt-1.5 disabled:opacity-50"
                />
              </>
            ) : null}
            <div className="mt-4 flex gap-2.5 rounded-xl bg-paper-dim p-3">
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                <circle cx="10" cy="10" r="7" />
                <path d="M10 9v2.5" />
                <path d="M10 13.2h.01" strokeWidth={2.4} />
              </svg>
              <p className="text-[11px] leading-relaxed text-muted">
                Posts save to the same workspace the mobile app uses. They show up there too, and
                the worker publishes them whether the app is open or not.
              </p>
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}
