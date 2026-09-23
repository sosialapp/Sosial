'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import ChannelAvatar, { channelAvatar } from '@/components/ChannelAvatar';
import { providerMeta } from '@/lib/providers';
import { createPost } from '@/lib/posts';
import { createClient } from '@/lib/supabase/client';
import { fromDateTimeLocal, toDateTimeLocal } from '@/lib/format';
import type { ConnectedChannel, WorkspaceInfo } from '@/lib/types';

/**
 * Quick post: type, pick channels, ship. No media, no title, no AI —
 * the full composer lives at /new.
 */
export default function QuickPost({
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
  const ready = channels.filter((c) => c.status === 'connected');
  const [body, setBody] = useState('');
  const [picked, setPicked] = useState<string[]>(() => ready.map((c) => c.id));
  const [when, setWhen] = useState(() => toDateTimeLocal(null));
  const [busy, setBusy] = useState<'now' | 'schedule' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setDone(null);
  }

  async function submit(e: FormEvent, mode: 'now' | 'schedule') {
    e.preventDefault();
    setErr(null);
    setDone(null);
    const chosen = ready.filter((c) => picked.includes(c.id));
    if (!chosen.length) {
      setErr('Pick at least one channel.');
      return;
    }
    if (!body.trim()) {
      setErr('Write something first.');
      return;
    }
    if (mode === 'schedule' && !fromDateTimeLocal(when)) {
      setErr('Choose a valid date and time.');
      return;
    }
    setBusy(mode);
    try {
      const sb = createClient();
      const text = body.trim();
      await createPost(sb, {
        workspaceId,
        userId,
        role,
        title: text.split('\n')[0].slice(0, 60),
        body: text,
        mode,
        scheduleIso: mode === 'schedule' ? fromDateTimeLocal(when) : null,
        channels: chosen,
        files: [],
      });
      setBody('');
      setDone(mode === 'now' ? 'Posted. Watch the queue.' : 'Scheduled.');
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not save the post.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card p-5" aria-label="Quick post">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-base font-extrabold tracking-tight">Quick post</p>
          <p className="mt-0.5 text-xs text-muted">Type, pick channels, ship.</p>
        </div>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink"
          aria-hidden="true"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.5 3.5 16.5 6.5 7 16l-4 1 1-4L13.5 3.5Z" />
          </svg>
        </span>
      </div>

      {ready.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Nothing connected yet.{' '}
          <Link href="/channels" className="font-bold text-ink hover:underline">
            Connect a channel
          </Link>{' '}
          to quick post.
        </p>
      ) : (
        <form onSubmit={(e) => submit(e, 'now')}>
          <div className="mt-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Channels">
            {ready.map((c) => {
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
                  <ChannelAvatar
                    provider={c.provider}
                    avatar={channelAvatar(c.metadata)}
                    size={24}
                  />
                  {providerMeta(c.provider).label}
                </button>
              );
            })}
          </div>

          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setDone(null);
            }}
            placeholder="What's on your mind?"
            rows={3}
            aria-label="Post text"
            className="field mt-3 min-h-[84px] resize-y"
          />

          {err ? <p className="mt-2 text-xs font-bold text-[#9F2F2D]">{err}</p> : null}
          {done ? <p className="mt-2 text-xs font-bold text-[#346538]">{done}</p> : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              aria-label="Schedule for"
              className="field !w-auto flex-1 py-1.5 text-xs sm:flex-none"
            />
            <span className="flex-1 sm:hidden" />
            <button
              type="button"
              onClick={(e) => submit(e, 'schedule')}
              disabled={busy !== null}
              className="btn btn-ghost !py-1.5 !text-xs"
            >
              {busy === 'schedule' ? 'Scheduling…' : 'Schedule'}
            </button>
            <button type="submit" disabled={busy !== null} className="btn btn-primary !py-1.5 !text-xs">
              {busy === 'now' ? 'Posting…' : 'Post now'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
