'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import ChannelAvatar, { channelAvatar } from '@/components/ChannelAvatar';
import AiCard from '@/components/AiCard';
import DateTimePicker from '@/components/DateTimePicker';
import { providerMeta } from '@/lib/providers';
import { createChain, createPost, type ComposeMode } from '@/lib/posts';
import { createClient } from '@/lib/supabase/client';
import type { ConnectedChannel, WorkspaceInfo } from '@/lib/types';

/** The only UI library besides gsap — full emoji menu with search. */
const EmojiPicker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => <div className="p-2 text-xs text-faint">Loading…</div>,
});

/** Native reply-chains exist on these four channels only — same as the app. */
const THREAD_PROVIDERS = ['x', 'threads', 'mastodon', 'bluesky'];

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
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

interface Segment {
  body: string;
  media: MediaItem[];
}

/**
 * One composer box: media strip (hold + drag to rearrange) on top, text,
 * toolbar (photo, video, emoji) with a live counter. Used for the first
 * post and every thread part alike.
 */
function PostBox({
  seg,
  onChange,
  onAddFiles,
  onRemoveMedia,
  onReorderMedia,
  placeholder,
  rows = 5,
  limit,
  label,
}: {
  seg: Segment;
  onChange: (body: string) => void;
  onAddFiles: (list: FileList | null) => void;
  onRemoveMedia: (i: number) => void;
  onReorderMedia: (from: number, to: number) => void;
  placeholder: string;
  rows?: number;
  limit: number;
  label: string;
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);
  const over = seg.body.length > limit;

  function pick(accept: string) {
    const el = fileRef.current;
    if (!el) return;
    el.accept = accept;
    el.click();
  }

  return (
    <div className="rounded-xl border border-line bg-paper focus-within:border-ink/40">
      {/* Media strip — above the text, hold + drag to rearrange */}
      {seg.media.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto p-2 pb-0">
          {seg.media.map((f, i) => (
            <span
              key={`${f.file.name}-${i}`}
              draggable
              onDragStart={() => {
                dragFrom.current = i;
              }}
              onDragOver={(e) => {
                e.preventDefault();
                const from = dragFrom.current;
                if (from !== null && from !== i) {
                  onReorderMedia(from, i);
                  dragFrom.current = i;
                }
              }}
              onDragEnd={() => {
                dragFrom.current = null;
              }}
              className="relative block h-20 w-20 shrink-0 cursor-grab overflow-hidden rounded-xl bg-paper-dim active:cursor-grabbing"
              title="Drag to rearrange"
            >
              {f.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={f.url} muted playsInline className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => onRemoveMedia(i)}
                aria-label="Remove media"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] leading-none text-white"
              >
                ×
              </button>
              {seg.media.length > 1 ? (
                <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[9px] font-bold text-white" aria-hidden="true">
                  {i + 1}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      <textarea
        value={seg.body}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        aria-label={label}
        className="min-h-[110px] w-full resize-y bg-transparent px-3 pt-2.5 text-sm text-ink placeholder:text-faint focus:outline-none"
      />

      <div className="flex items-center gap-0.5 border-t border-line-soft px-2 py-1.5">
        <button
          type="button"
          onClick={() => pick('image/*')}
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
          onClick={() => pick('video/*')}
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
            <div className="absolute bottom-9 left-0 z-30 rounded-xl border border-line bg-card shadow-[0_18px_40px_-16px_rgba(25,21,18,0.4)]" role="dialog" aria-label="Emoji picker">
              <EmojiPicker
                onEmojiClick={(d: { emoji: string }) => {
                  onChange(seg.body + d.emoji);
                  setEmojiOpen(false);
                }}
                searchPlaceholder="Search emoji…"
                width={320}
                height={380}
                previewConfig={{ showPreview: false }}
              />
            </div>
          ) : null}
        </div>
        <span className="flex-1" />
        <span className={`text-[11px] ${over ? 'font-bold text-[#9F2F2D]' : 'text-faint'}`}>
          {seg.body.length} / {limit}
        </span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onAddFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/**
 * Create hub post tab: composer card (channel pills, inbox media with drag
 * reorder, thread link, dashboard-style mode row) + AI studio card bound to
 * the same channels and thread state.
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
  const [segs, setSegs] = useState<Segment[]>(() => [
    {
      body: initialBody || initialTitle,
      media: initialFiles.map((file) => ({
        file,
        kind: (file.type.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
        url: URL.createObjectURL(file),
      })),
    },
  ]);
  const [picked, setPicked] = useState<string[]>(() => ready.map((c) => c.id));
  const [thread, setThread] = useState(false);
  const [parts, setParts] = useState(3);
  const [mode, setMode] = useState<'now' | 'schedule'>('schedule');
  const [whenIso, setWhenIso] = useState<string | null>(null);
  const [tz, setTz] = useState(deviceZone);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const chosenProviders = useMemo(
    () => Array.from(new Set(ready.filter((c) => picked.includes(c.id)).map((c) => c.provider))),
    [ready, picked],
  );
  const limit = useMemo(() => {
    const ls = ready.filter((c) => picked.includes(c.id)).map((c) => providerMeta(c.provider).limit);
    return ls.length ? Math.min(...ls) : 2200;
  }, [ready, picked]);

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function setThreadMode(v: boolean) {
    setThread(v);
    if (v) {
      // Drop channels that cannot carry a reply-chain, and seed part 2.
      setPicked((prev) => prev.filter((id) => {
        const c = ready.find((x) => x.id === id);
        return c ? THREAD_PROVIDERS.includes(c.provider) : false;
      }));
      setSegs((prev) => {
        const need = Math.max(2, parts);
        const next = [...prev];
        while (next.length < need) next.push({ body: '', media: [] });
        return next.slice(0, need);
      });
    }
  }

  function setPartsCount(n: number) {
    const clamped = Math.max(2, Math.min(8, n));
    setParts(clamped);
    setSegs((prev) => {
      const next = [...prev];
      while (next.length < clamped) next.push({ body: '', media: [] });
      return next.slice(0, clamped);
    });
  }

  /* ------------------------- per-segment helpers ------------------------ */

  function addFilesTo(i: number, list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).map((file) => ({
      file,
      kind: (file.type.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
      url: URL.createObjectURL(file),
    }));
    setSegs((prev) =>
      prev.map((s, j) => (j === i ? { ...s, media: [...s.media, ...next].slice(0, 10) } : s)),
    );
  }

  function removeMediaFrom(i: number, mi: number) {
    setSegs((prev) =>
      prev.map((s, j) => {
        if (j !== i) return s;
        const media = [...s.media];
        const [gone] = media.splice(mi, 1);
        if (gone) URL.revokeObjectURL(gone.url);
        return { ...s, media };
      }),
    );
  }

  function reorderMediaIn(i: number, from: number, to: number) {
    setSegs((prev) =>
      prev.map((s, j) => {
        if (j !== i) return s;
        const media = [...s.media];
        const [moved] = media.splice(from, 1);
        if (moved) media.splice(to, 0, moved);
        return { ...s, media };
      }),
    );
  }

  /* ------------------------------- submit ------------------------------- */

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
    const live = segs.filter((s) => s.body.trim() || s.media.length > 0);
    if (live.length === 0) {
      setErr('Add a caption or some media first.');
      return;
    }
    if (segs[0] && segs[0].body.length > limit) {
      setErr(`Caption is ${segs[0].body.length - limit} characters over the strictest channel limit.`);
      return;
    }
    setBusy(true);
    try {
      const sb = createClient();
      if (!thread) {
        const s0 = segs[0];
        await createPost(sb, {
          workspaceId,
          userId,
          role,
          title: s0.body.trim().split('\n')[0].slice(0, 60),
          body: s0.body.trim(),
          mode: submitMode,
          scheduleIso: submitMode === 'schedule' ? whenIso : null,
          channels: chosen,
          files: s0.media.map(({ file, kind }) => ({ file, kind })),
          timezone: tz,
        });
      } else {
        await createChain(sb, {
          workspaceId,
          userId,
          role,
          segments: live.map((s) => ({ body: s.body.trim(), files: s.media.map(({ file, kind }) => ({ file, kind })) })),
          mode: submitMode,
          startIso: submitMode === 'schedule' ? whenIso : null,
          gapMinutes: 0,
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
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-base font-extrabold tracking-tight">Create your post</p>
              <span className="flex-1" />
              {/* Mode pill — top, dashboard style */}
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
            </div>

            {/* Schedule row — top, next to the title */}
            {mode === 'schedule' ? (
              <div className="mt-3">
                <DateTimePicker
                  value={whenIso}
                  timezone={tz}
                  onChange={setWhenIso}
                  onTimezoneChange={setTz}
                />
              </div>
            ) : null}

            {/* Channel pills — dashboard style; thread narrows the cast */}
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
                  const chainOk = !thread || THREAD_PROVIDERS.includes(c.provider);
                  const on = picked.includes(c.id) && chainOk;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => chainOk && toggle(c.id)}
                      aria-pressed={on}
                      disabled={!chainOk}
                      title={
                        !chainOk
                          ? 'Thread posts go to X, Threads, Mastodon and Bluesky only'
                          : (c.display_name ?? providerMeta(c.provider).label)
                      }
                      className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 text-xs font-bold transition ${
                        !chainOk
                          ? 'cursor-not-allowed border-line bg-paper text-faint opacity-30'
                          : on
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

            {thread ? (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-faint">
                <BranchIcon className="h-3 w-3" />
                Thread posts go to X, Threads, Mastodon and Bluesky — parts publish as one reply chain.
              </p>
            ) : null}

            {/* Part 1 — same box as every other part */}
            <div className="mt-3">
              <PostBox
                seg={segs[0] ?? { body: '', media: [] }}
                onChange={(body) => setSegs((prev) => prev.map((s, j) => (j === 0 ? { ...s, body } : s)))}
                onAddFiles={(list) => addFilesTo(0, list)}
                onRemoveMedia={(mi) => removeMediaFrom(0, mi)}
                onReorderMedia={(from, to) => reorderMediaIn(0, from, to)}
                placeholder="What's on your mind?"
                limit={limit}
                label="Post text"
              />
            </div>

            {/* Thread parts */}
            {thread ? (
              <div className="mt-2 space-y-2">
                {segs.slice(1).map((s, i) => {
                  const idx = i + 1;
                  return (
                    <div key={idx}>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[11px] font-bold text-faint">
                          <BranchIcon className="h-3 w-3" />
                          Part {idx + 1}
                        </span>
                        <span className="flex-1" />
                        {segs.length > 2 ? (
                          <button
                            type="button"
                            onClick={() => setSegs((prev) => prev.filter((_, j) => j !== idx))}
                            aria-label={`Remove part ${idx + 1}`}
                            className="text-[11px] font-bold text-muted transition hover:text-ink"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <PostBox
                        seg={s}
                        onChange={(body) => setSegs((prev) => prev.map((x, j) => (j === idx ? { ...x, body } : x)))}
                        onAddFiles={(list) => addFilesTo(idx, list)}
                        onRemoveMedia={(mi) => removeMediaFrom(idx, mi)}
                        onReorderMedia={(from, to) => reorderMediaIn(idx, from, to)}
                        placeholder={`Part ${idx + 1}…`}
                        rows={3}
                        limit={limit}
                        label={`Thread part ${idx + 1}`}
                      />
                    </div>
                  );
                })}
                {segs.length < 8 ? (
                  <button
                    type="button"
                    onClick={() => setSegs((prev) => [...prev, { body: '', media: [] }])}
                    className="text-xs font-bold text-ink hover:underline"
                  >
                    + Add part
                  </button>
                ) : null}
              </div>
            ) : null}

            {err ? <p className="mt-3 text-xs font-bold text-[#9F2F2D]">{err}</p> : null}

            {/* One row: thread link · save draft · post — aligned */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setThreadMode(!thread)}
                aria-pressed={thread}
                className="flex items-center gap-1.5 text-xs font-bold text-accent-ink transition hover:opacity-80"
              >
                <BranchIcon />
                {thread ? 'Turn off thread' : 'Post as thread'}
              </button>
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
                {busy ? 'Sending…' : mode === 'now' ? 'Post now' : 'Schedule post'}
              </button>
            </div>
          </section>
        </div>

        {/* Right rail: AI studio */}
        <div className="min-w-0 xl:col-span-2">
          <AiCard
            providers={chosenProviders}
            thread={thread}
            onThreadChange={setThreadMode}
            parts={parts}
            onPartsChange={setPartsCount}
            onResult={(bodies) => {
              setSegs((prev) => {
                const next = bodies.map((b) => ({ body: b, media: [] as MediaItem[] }));
                if (next[0]) next[0].media = prev[0]?.media ?? [];
                return next;
              });
            }}
            appliedNote="Applied to the composer — edit freely, then post."
          />
        </div>
      </div>
    </form>
  );
}
