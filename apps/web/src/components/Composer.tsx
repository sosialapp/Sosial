'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ConnectedChannel, WorkspaceInfo } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { createPost, createChain, type ComposeMode } from '@/lib/posts';
import { generateCaptions, withHashtags } from '@/lib/ai';
import { BrandIcon } from '@/components/BrandIcon';
import { providerMeta } from '@/lib/providers';
import { fromDateTimeLocal, toDateTimeLocal } from '@/lib/format';

const MODES: { id: ComposeMode; label: string }[] = [
  { id: 'draft', label: 'Save draft' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'now', label: 'Publish now' },
];

const TONES = ['auto', 'bold', 'funny', 'professional', 'friendly'] as const;

type Kind = 'single' | 'chain';

interface Seg {
  key: number;
  body: string;
}

export default function Composer({
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
  /** Prefill for "post this idea" — parent remounts (key) to apply. */
  initialTitle?: string;
  initialBody?: string;
  /** Files attached by a design template — parent remounts (key) to apply. */
  initialFiles?: File[];
}) {
  const router = useRouter();
  const isMember = role === 'member';
  const ready = channels.filter((c) => c.status === 'connected');
  const [kind, setKind] = useState<Kind>('single');
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [mode, setMode] = useState<ComposeMode>('schedule');
  const [when, setWhen] = useState(() => toDateTimeLocal(null));
  const [picked, setPicked] = useState<string[]>(() => ready.map((c) => c.id));
  const [files, setFiles] = useState<{ file: File; kind: 'image' | 'video'; url: string }[]>(() =>
    initialFiles.map((file) => ({
      file,
      kind: (file.type.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
      url: URL.createObjectURL(file),
    })),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Chain state: lead + 2 follower parts; the prefill (if any) seeds part 1.
  const segKey = useRef(3);
  const [segments, setSegments] = useState<Seg[]>(() => [
    { key: 0, body: initialBody },
    { key: 1, body: '' },
    { key: 2, body: '' },
  ]);
  const [gap, setGap] = useState(10);

  // AI assist.
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<string>('auto');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(
    () => () => {
      for (const f of filesRef.current) URL.revokeObjectURL(f.url);
    },
    [],
  );

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).map((file) => ({
      file,
      kind: (file.type.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
      url: URL.createObjectURL(file),
    }));
    setFiles((prev) => [...prev, ...next].slice(0, 10));
  }

  function removeFile(i: number) {
    setFiles((prev) => {
      const next = [...prev];
      const [gone] = next.splice(i, 1);
      if (gone) URL.revokeObjectURL(gone.url);
      return next;
    });
  }

  function setSegBody(key: number, v: string) {
    setSegments((prev) => prev.map((s) => (s.key === key ? { ...s, body: v } : s)));
  }

  function addSeg() {
    setSegments((prev) => (prev.length >= 8 ? prev : [...prev, { key: segKey.current++, body: '' }]));
  }

  function removeSeg(key: number) {
    setSegments((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.key !== key)));
  }

  function moveSeg(key: number, dir: -1 | 1) {
    setSegments((prev) => {
      const i = prev.findIndex((s) => s.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const chosenProviders = Array.from(
    new Set(ready.filter((c) => picked.includes(c.id)).map((c) => c.provider)),
  );
  const strictest = Math.min(
    2200,
    ...ready.filter((c) => picked.includes(c.id)).map((c) => providerMeta(c.provider).limit),
  );

  async function runAi() {
    setAiErr(null);
    const t = topic.trim();
    if (!t) {
      setAiErr('Describe the topic first.');
      return;
    }
    if (!chosenProviders.length) {
      setAiErr('Pick at least one channel — the AI sizes copy to the strictest one.');
      return;
    }
    const count = kind === 'chain' ? segments.length : 1;
    setAiBusy(true);
    try {
      const sb = createClient();
      const segs = await generateCaptions(sb, {
        topic: t,
        providers: chosenProviders,
        count,
        tone,
      });
      if (kind === 'chain') {
        setSegments(segs.map((s) => ({ key: segKey.current++, body: withHashtags(s.caption, s.hashtags) })));
      } else {
        setBody(withHashtags(segs[0].caption, segs[0].hashtags));
      }
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : 'AI generation failed.');
    } finally {
      setAiBusy(false);
    }
  }

  const submitLabel =
    isMember && mode === 'now'
      ? 'Send for approval'
      : kind === 'chain'
        ? `${MODES.find((m) => m.id === mode)?.label} chain`
        : MODES.find((m) => m.id === mode)?.label;

  async function submitSingle(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const chosen = ready.filter((c) => picked.includes(c.id));
    if (!chosen.length) {
      setErr('Pick at least one channel.');
      return;
    }
    if (mode === 'schedule' && !fromDateTimeLocal(when)) {
      setErr('Choose a valid date and time.');
      return;
    }
    if (!body.trim() && !title.trim() && files.length === 0) {
      setErr('Add a caption or some media first.');
      return;
    }
    setBusy(true);
    try {
      const sb = createClient();
      await createPost(sb, {
        workspaceId,
        userId,
        role,
        title,
        body,
        mode,
        scheduleIso: fromDateTimeLocal(when),
        channels: chosen,
        files,
      });
      router.push('/queue');
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not save the post.');
      setBusy(false);
    }
  }

  async function submitChain(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const chosen = ready.filter((c) => picked.includes(c.id));
    if (!chosen.length) {
      setErr('Pick at least one channel.');
      return;
    }
    if (mode === 'schedule' && !fromDateTimeLocal(when)) {
      setErr('Choose a valid start date and time.');
      return;
    }
    const liveIdx = segments.map((_, i) => i).filter((i) => segments[i].body.trim());
    const payload =
      liveIdx.length > 0
        ? liveIdx.map((i, k) => ({ body: segments[i].body, files: k === 0 ? files : [] }))
        : files.length > 0
          ? [{ body: '', files }]
          : null;
    if (!payload) {
      setErr('Write at least one part of the chain first.');
      return;
    }
    setBusy(true);
    try {
      const sb = createClient();
      await createChain(sb, {
        workspaceId,
        userId,
        role,
        segments: payload,
        mode,
        startIso: fromDateTimeLocal(when),
        gapMinutes: gap,
        channels: chosen,
      });
      router.push('/queue');
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not save the chain.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={kind === 'chain' ? submitChain : submitSingle} className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <p className="eyebrow">Composer</p>
          <h1 className="font-display text-xl font-extrabold tracking-tight">
            {kind === 'chain' ? 'New chain' : 'New post'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-line bg-paper p-0.5" role="tablist" aria-label="Post kind">
            {(['single', 'chain'] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  kind === k ? 'bg-accent text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {k === 'single' ? 'Single' : 'Chain'}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      </header>

      {err && (
        <p className="border-b border-line bg-[#FDEBEC] px-6 py-2 text-sm text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      )}

      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          {kind === 'single' ? (
            <>
              <input
                className="field font-display text-lg font-bold"
                placeholder="Title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className="field min-h-[240px] resize-y leading-relaxed"
                placeholder="What do you want to share?"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <p className="text-xs text-faint">
                {body.length.toLocaleString()} chars · strictest picked channel allows{' '}
                {strictest.toLocaleString()}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                One thread, published as a sequence — part 1 goes first, the rest follow{' '}
                {mode === 'draft' ? 'when you publish them' : `every ${gap} min`}.
              </p>
              {segments.map((s, i) => (
                <div key={s.key} className="card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="eyebrow">
                      Part {i + 1}
                      {i === 0 && files.length > 0 ? ' · carries the media' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Move up"
                        onClick={() => moveSeg(s.key, -1)}
                        disabled={i === 0}
                        className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-paper disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        title="Move down"
                        onClick={() => moveSeg(s.key, 1)}
                        disabled={i === segments.length - 1}
                        className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-paper disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        title="Remove part"
                        onClick={() => removeSeg(s.key)}
                        disabled={segments.length <= 1}
                        className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-paper disabled:opacity-30"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                  <textarea
                    className="field min-h-[120px] resize-y leading-relaxed"
                    placeholder={
                      i === 0
                        ? 'The hook — makes people stop and read on…'
                        : i === segments.length - 1
                          ? 'The landing — takeaway + soft call to action…'
                          : 'Build the idea…'
                    }
                    value={s.body}
                    onChange={(e) => setSegBody(s.key, e.target.value)}
                  />
                  <p className="mt-1 text-xs text-faint">
                    {s.body.length.toLocaleString()} chars · strictest picked channel allows{' '}
                    {strictest.toLocaleString()}
                  </p>
                </div>
              ))}
              {segments.length < 8 && (
                <button type="button" onClick={addSeg} className="btn btn-ghost w-full">
                  + Add part ({segments.length}/8)
                </button>
              )}
            </>
          )}

          <div>
            <p className="eyebrow mb-2">Media{kind === 'chain' ? ' · attaches to part 1' : ''}</p>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card px-4 py-6 text-center hover:bg-paper">
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <span className="text-sm font-semibold text-soft">Add photos or video</span>
              <span className="mt-1 text-xs text-faint">Up to 10 files</span>
            </label>

            {files.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {files.map((f, i) => (
                  <div
                    key={`${f.file.name}-${i}`}
                    className="relative overflow-hidden rounded-xl border border-line bg-bone"
                  >
                    {f.kind === 'video' ? (
                      <video src={f.url} muted playsInline className="h-24 w-full object-cover" />
                    ) : (
                      <img src={f.url} alt={f.file.name} className="h-24 w-full object-cover" />
                    )}
                    {f.kind === 'video' && (
                      <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        VIDEO
                      </span>
                    )}
                    <button
                      type="button"
                      title="Remove"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                      onClick={() => removeFile(i)}
                    >
                      ×
                    </button>
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                      {f.file.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-5 lg:w-80">
          <div className="card space-y-3 p-4">
            <p className="eyebrow">AI captions</p>
            <textarea
              className="field min-h-[72px] resize-y text-sm"
              placeholder="What is this about? e.g. why we batch content on Sundays…"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <select
                className="field !w-auto flex-1 text-sm"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                aria-label="Tone"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={runAi}
                disabled={aiBusy}
                className="btn btn-primary shrink-0 !px-4 !py-2 !text-xs"
              >
                {aiBusy ? 'Writing…' : kind === 'chain' ? `Write ${segments.length} parts` : 'Write caption'}
              </button>
            </div>
            {aiErr && <p className="text-xs text-[#9F2F2D] dark:text-[#f2a8a8]">{aiErr}</p>}
            <p className="text-xs text-faint">
              Sized to ≤ {strictest.toLocaleString()} chars for your picked channels. Fills the{' '}
              {kind === 'chain' ? 'parts below' : 'caption above'} with caption + hashtags — edit freely.
            </p>
          </div>

          <div className="card p-4">
            <p className="eyebrow mb-3">Channels</p>
            {ready.length === 0 ? (
              <p className="text-sm text-muted">
                No connected channels yet. Connect one in the mobile app, then come back.
              </p>
            ) : (
              <div className="space-y-1.5">
                {ready.map((c) => {
                  const meta = providerMeta(c.provider);
                  const on = picked.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${
                        on ? 'border-accent bg-accent-soft' : 'border-line bg-paper hover:bg-bone'
                      }`}
                    >
                      <BrandIcon provider={c.provider} className="h-6 w-6 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{meta.label}</span>
                        <span className="block truncate text-xs text-muted">
                          {c.handle ? `@${c.handle}` : c.display_name ?? c.external_id} ·{' '}
                          {meta.limit.toLocaleString()} chars
                        </span>
                      </span>
                      <span className={`text-xs font-bold ${on ? 'text-accent' : 'text-faint'}`}>
                        {on ? '✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card p-4">
            <p className="eyebrow mb-3">When</p>
            <div className="flex flex-wrap gap-1.5">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    mode === m.id ? 'bg-accent text-white' : 'bg-surface text-soft hover:bg-line'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {mode === 'schedule' && (
              <label className="mt-3 block text-xs font-bold text-muted">
                {kind === 'chain' ? 'Part 1 goes out at' : 'Goes out at'}
                <input
                  className="field mt-1"
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </label>
            )}
            {kind === 'chain' && mode !== 'draft' && (
              <label className="mt-3 block text-xs font-bold text-muted">
                Minutes between parts
                <input
                  className="field mt-1"
                  type="number"
                  min={0}
                  max={1440}
                  value={gap}
                  onChange={(e) => setGap(Math.max(0, Math.min(1440, Number(e.target.value) || 0)))}
                />
              </label>
            )}
            {mode === 'now' && (
              <p className="mt-3 text-xs text-muted">
                {isMember
                  ? 'An owner or admin approves it before the worker publishes.'
                  : kind === 'chain'
                    ? 'Queues the chain immediately; parts go out spaced by the gap above.'
                    : 'Queues the post immediately; the worker publishes it within a minute.'}
              </p>
            )}
            {mode === 'draft' && (
              <p className="mt-3 text-xs text-muted">Keeps it out of the queue until you publish.</p>
            )}
            {isMember && mode !== 'draft' && (
              <p className="mt-3 rounded-lg bg-accent-soft px-2.5 py-2 text-xs text-accent-ink">
                You&apos;re a team member — this goes to an owner or admin for approval first.
              </p>
            )}
          </div>

          <p className="text-xs text-faint">
            Posts save to the same workspace the mobile app uses — they show up there too, and the
            worker publishes them whether the app is open or not.
          </p>
        </aside>
      </div>
    </form>
  );
}
