'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import ChannelAvatar from '@/components/ChannelAvatar';
import { channelAvatar } from '@/lib/channelAvatar';
import DateTimePicker from '@/components/DateTimePicker';
import { EmojiTextarea } from '@/components/Emoji';
import { providerMeta } from '@/lib/providers';
import { createPost } from '@/lib/posts';
import { leadTimeMessage, minQueueTime, queueTooSoon } from '@/lib/queue';
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
  * the full composer lives at /post.
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
  const [when, setWhen] = useState<string | null>(() => new Date(minQueueTime()).toISOString());
  const [tz, setTz] = useState(deviceZone);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [confirmNow, setConfirmNow] = useState(false);
  const nowConfirmed = useRef(false);

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setDone(null);
  }

  async function submit(e: FormEvent | null) {
    e?.preventDefault();
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
    if (mode === 'schedule' && when && queueTooSoon(when)) {
      setErr(leadTimeMessage());
      return;
    }
    // Post-now always confirms with the destination list after validating.
    if (mode === 'now' && !nowConfirmed.current) {
      setConfirmNow(true);
      return;
    }
    nowConfirmed.current = false;
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
    <section className="card border border-line p-5" aria-label="Quick post">
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
                if (m === 'schedule' && (!when || queueTooSoon(when))) {
                  setWhen(new Date(minQueueTime()).toISOString());
                }
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
              const label = providerMeta(c.provider).label;
              const rawHandle =
                typeof c.handle === 'string' && c.handle.trim()
                  ? c.handle.trim().replace(/^@/, '')
                  : null;
              const sub =
                rawHandle ??
                (c.display_name && c.display_name !== label ? c.display_name : null);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-pressed={on}
                  title={c.display_name ?? label}
                  className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 text-xs font-bold transition ${
                    on
                      ? 'border-ink bg-paper text-ink'
                      : 'border-line bg-paper text-faint opacity-60 hover:opacity-100'
                  }`}
                >
                  <ChannelAvatar
                    provider={c.provider}
                    avatar={channelAvatar(c.metadata)}
                    size={30}
                  />
                  <span className="min-w-0 leading-tight text-left">
                    <span className="block">{label}</span>
                    {sub ? (
                      <span className="block truncate text-[10px] font-semibold text-muted">
                        {rawHandle ? `@${rawHandle}` : sub}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          <EmojiTextarea
            value={body}
            onChange={(v) => {
              setBody(v);
              setDone(null);
            }}
            placeholder="What's on your mind?"
            rows={3}
            aria-label="Post text"
            className="field mt-3 min-h-[84px] resize-y"
          />

          {err ? <p className="mt-2 text-xs font-bold text-[#9F2F2D]">{err}</p> : null}
          {done ? <p className="mt-2 text-xs font-bold text-[#346538]">{done}</p> : null}

          {confirmNow ? (
            <div
              className="fixed inset-0 z-[100] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm post now"
            >
              <div
                className="absolute inset-0 bg-ink/50"
                onClick={() => {
                  nowConfirmed.current = false;
                  setConfirmNow(false);
                }}
                aria-hidden="true"
              />
              <div className="relative flex min-h-full items-center justify-center p-4">
                <div className="relative my-auto w-full max-w-md rounded-3xl border border-line bg-card p-6 shadow-[0_32px_80px_-24px_rgba(28,25,23,0.5)]">
                  <h2 className="font-display text-lg font-extrabold tracking-tight">
                    Post now to {ready.filter((c) => picked.includes(c.id)).length} channel
                    {picked.length === 1 ? '' : 's'}?
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {ready
                      .filter((c) => picked.includes(c.id))
                      .map((c) => {
                        const label = providerMeta(c.provider).label;
                        const rawHandle =
                          typeof c.handle === 'string' && c.handle.trim()
                            ? c.handle.trim().replace(/^@/, '')
                            : null;
                        const sub =
                          rawHandle ??
                          (c.display_name && c.display_name !== label ? c.display_name : null);
                        return (
                          <li key={c.id} className="flex items-center gap-2.5">
                            <ChannelAvatar
                              provider={c.provider}
                              avatar={channelAvatar(c.metadata)}
                              size={30}
                            />
                            <span className="min-w-0 flex-1 leading-tight">
                              <span className="block truncate text-sm font-bold">{label}</span>
                              {sub ? (
                                <span className="block truncate text-xs text-muted">
                                  {rawHandle ? `@${rawHandle}` : sub}
                                </span>
                              ) : null}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                  {body.trim() ? (
                    <p className="mt-3 rounded-xl bg-paper-dim px-3 py-2 text-xs text-soft">
                      “{body.trim().replace(/\s+/g, ' ').slice(0, 140)}
                      {body.trim().length > 140 ? '…' : ''}”
                    </p>
                  ) : null}
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        nowConfirmed.current = false;
                        setConfirmNow(false);
                      }}
                      className="btn btn-ghost flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        nowConfirmed.current = true;
                        setConfirmNow(false);
                        void submit(null);
                      }}
                      className="btn btn-primary flex-1"
                    >
                      Post now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

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
