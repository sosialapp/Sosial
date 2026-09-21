'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ConnectedChannel, WorkspaceInfo } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { createPost, type ComposeMode } from '@/lib/posts';
import { BrandIcon } from '@/components/BrandIcon';
import { providerMeta } from '@/lib/providers';
import { fromDateTimeLocal, toDateTimeLocal } from '@/lib/format';

const MODES: { id: ComposeMode; label: string }[] = [
  { id: 'draft', label: 'Save draft' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'now', label: 'Publish now' },
];

export default function Composer({
  channels,
  workspaceId,
  userId,
  role,
}: {
  channels: ConnectedChannel[];
  workspaceId: string;
  userId: string;
  role: WorkspaceInfo['role'];
}) {
  const router = useRouter();
  const isMember = role === 'member';
  const ready = channels.filter((c) => c.status === 'connected');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<ComposeMode>('schedule');
  const [when, setWhen] = useState(() => toDateTimeLocal(null));
  const [picked, setPicked] = useState<string[]>(() => ready.map((c) => c.id));
  const [files, setFiles] = useState<{ file: File; kind: 'image' | 'video'; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  const submitLabel = isMember && mode === 'now' ? 'Send for approval' : MODES.find((m) => m.id === mode)?.label;

  async function submit(e: FormEvent) {
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

  return (
    <form onSubmit={submit} className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <p className="eyebrow">Composer</p>
          <h1 className="font-display text-xl font-extrabold tracking-tight">New post</h1>
        </div>
        <button
          className="btn bg-zest font-bold text-ink hover:brightness-95"
          disabled={busy}
          type="submit"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
      </header>

      {err && (
        <p className="border-b border-line bg-[#FDEBEC] px-6 py-2 text-sm text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      )}

      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
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

          <div>
            <p className="eyebrow mb-2">Media</p>
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
                        on ? 'border-zest bg-zest/10' : 'border-line bg-paper hover:bg-bone'
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
                      <span className={`text-xs font-bold ${on ? 'text-ink' : 'text-faint'}`}>
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
                    mode === m.id ? 'bg-zest text-ink' : 'bg-surface text-soft hover:bg-line'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {mode === 'schedule' && (
              <input
                className="field mt-3"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            )}
            {mode === 'now' && (
              <p className="mt-3 text-xs text-muted">
                {isMember
                  ? 'An owner or admin approves it before the worker publishes.'
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
