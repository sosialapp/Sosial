'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ConnectedChannel } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { createPost, type ComposeMode } from '@/lib/posts';
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
}: {
  channels: ConnectedChannel[];
  workspaceId: string;
  userId: string;
}) {
  const router = useRouter();
  const ready = channels.filter((c) => c.status === 'connected');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<ComposeMode>('schedule');
  const [when, setWhen] = useState(() => toDateTimeLocal(null));
  const [picked, setPicked] = useState<string[]>(() => ready.map((c) => c.id));
  const [files, setFiles] = useState<{ file: File; kind: 'image' | 'video' }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).map((file) => ({
      file,
      kind: (file.type.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
    }));
    setFiles((prev) => [...prev, ...next].slice(0, 10));
  }

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
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'Saving…' : MODES.find((m) => m.id === mode)?.label}
        </button>
      </header>

      {err && <p className="border-b border-line bg-[#FDEBEC] px-6 py-2 text-sm text-[#9F2F2D]">{err}</p>}

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
              <div className="mt-3 flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <span key={`${f.file.name}-${i}`} className="pill bg-surface text-soft">
                    {f.kind === 'video' ? '▶ ' : '▣ '}
                    {f.file.name}
                    <button
                      type="button"
                      className="ml-2 text-muted hover:text-accent"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      ×
                    </button>
                  </span>
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
                        on ? 'border-accent bg-accent-soft' : 'border-line bg-paper hover:bg-bone'
                      }`}
                    >
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white"
                        style={{ background: meta.color }}
                      >
                        {meta.glyph}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{meta.label}</span>
                        <span className="block truncate text-xs text-muted">
                          {c.handle ? `@${c.handle}` : c.display_name ?? c.external_id}
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
              <input
                className="field mt-3"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            )}
            {mode === 'now' && (
              <p className="mt-3 text-xs text-muted">
                Queues the post immediately; the worker publishes it within a minute.
              </p>
            )}
            {mode === 'draft' && (
              <p className="mt-3 text-xs text-muted">Keeps it out of the queue until you publish.</p>
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
