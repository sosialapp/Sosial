'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface InboxChannel {
  id: string;
  display_name: string | null;
  handle: string | null;
}

export interface InboxMessage {
  id: string;
  channel_id: string;
  external_id: string;
  author_name: string | null;
  author_handle: string | null;
  body: string;
  has_media: boolean;
  external_created_at: string | null;
  reply_to_external_id: string | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * Inbox: inbound Discord messages per channel with an inline reply box.
 * Replies go through /api/inbox/reply into the normal queue (mode now),
 * so scheduling, quotas and approvals behave exactly like the composer.
 */
export default function InboxView({
  channels,
  messages,
}: {
  channels: InboxChannel[];
  messages: InboxMessage[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('all');
  const [openReply, setOpenReply] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const shown =
    filter === 'all' ? messages : messages.filter((m) => m.channel_id === filter);
  const nameOf = (id: string) => {
    const c = channels.find((x) => x.id === id);
    return c?.display_name ?? c?.handle ?? 'Channel';
  };

  const send = async (m: InboxMessage) => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/inbox/reply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel_id: m.channel_id, reply_to: m.external_id, text }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? 'Could not send the reply.');
      setDraft('');
      setOpenReply(null);
      setSent(m.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the reply.');
    } finally {
      setBusy(false);
    }
  };

  if (channels.length === 0) {
    return (
      <div className="card mt-4 p-5">
        <p className="text-sm text-muted">
          No Discord channels connected yet. Connect one in Channels and new messages
          will land here within minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Inbox channels">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
            filter === 'all'
              ? 'border-accent bg-accent text-ink'
              : 'border-line bg-card text-muted hover:bg-paper'
          }`}
        >
          All
        </button>
        {channels.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
              filter === c.id
                ? 'border-accent bg-accent text-ink'
                : 'border-line bg-card text-muted hover:bg-paper'
            }`}
          >
            {c.display_name ?? c.handle ?? 'Channel'}
          </button>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}

      <ul className="mt-3 space-y-2">
        {shown.map((m) => (
          <li key={m.id} className="card p-4">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-extrabold text-paper"
              >
                {(m.author_name ?? '?').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {m.author_name ?? 'Someone'}
                  <span className="ml-2 font-normal text-faint">
                    {nameOf(m.channel_id)} · {timeAgo(m.external_created_at)}
                  </span>
                </p>
              </div>
              {m.reply_to_external_id ? (
                <span className="shrink-0 rounded-full bg-paper-dim px-2.5 py-0.5 text-[11px] font-bold">
                  reply
                </span>
              ) : null}
              {sent === m.id ? (
                <span className="shrink-0 text-xs font-bold text-green-700">Sent ✓</span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
            {openReply === m.id ? (
              <div className="mt-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder={`Reply to ${m.author_name ?? 'them'}…`}
                  className="field min-h-[64px] resize-y text-sm"
                  aria-label="Reply text"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => send(m)}
                    disabled={busy || !draft.trim()}
                    className="btn btn-primary"
                  >
                    {busy ? 'Sending…' : 'Send reply'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenReply(null);
                      setDraft('');
                    }}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpenReply(m.id);
                  setDraft('');
                  setSent(null);
                }}
                className="mt-2 text-xs font-bold text-muted transition hover:text-ink"
              >
                Reply
              </button>
            )}
          </li>
        ))}
        {shown.length === 0 ? (
          <li className="card p-5 text-sm text-muted">
            Nothing here yet — new messages land within minutes of being posted in Discord.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
