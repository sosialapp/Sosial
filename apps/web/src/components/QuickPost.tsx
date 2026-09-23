'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import ChannelAvatar, { channelAvatar } from '@/components/ChannelAvatar';
import DateTimePicker from '@/components/DateTimePicker';
import { providerMeta } from '@/lib/providers';
import { createPost } from '@/lib/posts';
import { createClient } from '@/lib/supabase/client';
import type { ConnectedChannel, WorkspaceInfo } from '@/lib/types';

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Quick post: type, pick channels, ship. No media, no title, no AI —
 * the full composer lives at /create.
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
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [when, setWhen] = useState<string | null>(null);
  const [tz, setTz] = useState(deviceZone);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setDone(null);
  }

  async function submit(e: FormEvent) {
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
    if (mode === 'schedule' && !when) {
      setErr('Choose a date and time first.');
      return;
    }
    setBusy(true);
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
        scheduleIso: mode === 'schedule' ? when : null,
        channels: chosen,
        files: [],
        timezone: tz,
      });
      setBody('');
      setDone(mode === 'now' ? 'Posted. Watch the queue.' : 'Scheduled.');
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not save the post.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5" aria-label="Quick post">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <p className="font-display text-base font-extrabold tracking-tight">Quick post</p>
          <p className="mt-0.5 text-xs text-muted">Type, pick channels, ship.</p>
        </div>
        <span className="flex-1" />
        {/* Mode pill — top, dashboard style */}
        <div className="flex rounded-full border border-line bg-paper p-1" role="group" aria-label="Post mode">
          {(['now', 'schedule'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setDone(null);
              }}
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

      {/* Schedule row — top */}
      {mode === 'schedule' && ready.length > 0 ? (
        <div className="mt-3">
          <DateTimePicker
            value={when}
            timezone={tz}
            onChange={(iso) => {
              setWhen(iso);
              setDone(null);
            }}
            onTimezoneChange={setTz}
          />
        </div>
      ) : null}

      {ready.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Nothing connected yet.{' '}
          <Link href="/channels" className="font-bold text-ink hover:underline">
            Connect a channel
          </Link>{' '}
          to quick post.
        </p>
      ) : (
        <form onSubmit={submit}>
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

          {/* Action stays put — only the label changes. */}
          <div className="mt-3 flex items-center gap-2">
            <span className="flex-1" />
            <button type="submit" disabled={busy} className="btn btn-primary !py-1.5 !text-xs">
              {busy ? 'Sending…' : mode === 'now' ? 'Post now' : 'Schedule post'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
