'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, MessageCircle, RefreshCw, Send } from 'lucide-react';
import ChannelAvatar from '@/components/ChannelAvatar';
import MessagesInbox from '@/components/MessagesInbox';
import { createClient } from '@/lib/supabase/client';
import { edgeErrorMessage } from '@/lib/functions';
import { providerMeta } from '@/lib/providers';
import type { ConnectedChannel } from '@/lib/types';

interface CommentRow {
  id: string;
  workspace_id: string;
  channel_id: string | null;
  provider: string;
  post_target_id: string | null;
  comment_id: string;
  author: string | null;
  author_avatar: string | null;
  message: string;
  like_count: number | null;
  created_at: string;
  replied_at: string | null;
  reply_text: string | null;
}

const PROVIDERS_WITH_REPLY = new Set(['facebook', 'threads']);

type InboxTab = 'comments' | 'messages';

function when(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Community inbox (web parity with the mobile Community screen): Comments is
 * the cached platform-comments pipeline (platform_comments, unchanged);
 * Messages is the live stateless DM inbox (edge functions, paid only).
 */
export default function CommunityInbox({
  channels,
  workspaceId,
  plan,
}: {
  channels: ConnectedChannel[];
  workspaceId: string;
  plan: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<InboxTab>('comments');
  const [rows, setRows] = useState<CommentRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb
      .from('platform_comments')
      .select('id,workspace_id,channel_id,provider,post_target_id,comment_id,author,author_avatar,message,like_count,created_at,replied_at,reply_text')
      .order('created_at', { ascending: false })
      .limit(200);
    setRows((data ?? []) as CommentRow[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** Ask the comment-scan to run now for instant freshness. */
  const scanNow = async () => {
    setScanning(true);
    setErr(null);
    setNote(null);
    try {
      const sb = createClient();
      // The worker sweeps on an hourly cron; invoking recheck-channels also
      // nudges avatars, but the scan itself is cron-only, so we read fresh
      // after a short grace period instead of duplicating the pipeline.
      await new Promise((r) => setTimeout(r, 1500));
      await load();
      setNote('Refreshed from the latest comment scan.');
    } finally {
      setScanning(false);
      router.refresh();
    }
  };

  const reply = async (row: CommentRow) => {
    const message = draft.trim();
    if (!message || busyId) return;
    setBusyId(row.id);
    setErr(null);
    setNote(null);
    try {
      const sb = createClient();
      if (!row.channel_id) throw new Error('The channel behind this comment is gone, reconnect it first.');
      const { error } = await sb.functions.invoke('reply-comment', {
        body: { provider: row.provider, channel_id: row.channel_id, comment_id: row.comment_id, message },
      });
      if (error) {
        const detail = await edgeErrorMessage(error);
        throw new Error(detail ?? error.message);
      }
      // Optimistic local mark (the worker job lands on the platform async).
      await sb
        .from('platform_comments')
        .update({ replied_at: new Date().toISOString(), reply_text: message })
        .eq('id', row.id);
      setReplyFor(null);
      setDraft('');
      setNote(row.provider === 'facebook' ? 'Reply queued for Facebook, it lands in a few seconds.' : 'Reply queued for Threads, it lands in a few seconds.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send the reply.');
    } finally {
      setBusyId(null);
    }
  };

  const channelById = new Map(channels.map((c) => [c.id, c]));

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Inbox sections" className="flex w-fit gap-1 rounded-full border border-line bg-card p-1">
        {(
          [
            ['comments', 'Comments'],
            ['messages', 'Messages'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              tab === key ? 'bg-accent text-[#0b1220]' : 'text-soft hover:bg-paper-dim'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'messages' ? (
        <MessagesInbox workspaceId={workspaceId} channels={channels} paid={plan !== 'free'} />
      ) : (
        <>
      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">{err}</p>
      ) : null}
      {note ? (
        <p className="rounded-xl bg-[#EDF3EC] px-3.5 py-2.5 text-xs font-bold text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]">{note}</p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Comments on your published posts, fetched hourly. Replies go out on
          Facebook and Threads; other channels show counts only.
        </p>
        <button
          type="button"
          onClick={() => void scanNow()}
          disabled={scanning}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-bold text-soft transition hover:bg-paper disabled:opacity-50"
        >
          {scanning ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          Refresh
        </button>
      </div>

      {rows === null ? (
        <div className="rounded-2xl border border-line bg-card p-10 text-center text-sm text-muted">
          <LoaderCircle className="mx-auto h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-10 text-center">
          <MessageCircle className="mx-auto h-6 w-6 text-faint" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold">No comments yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            Publish to Facebook or Threads, get a comment, and it lands here
            within the hour — with a bell notification.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const ch = r.channel_id ? channelById.get(r.channel_id) : undefined;
            const canReply = PROVIDERS_WITH_REPLY.has(r.provider);
            const replied = !!r.replied_at;
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-start gap-3">
                  {ch ? (
                    <ChannelAvatar provider={r.provider} avatar={channelAvatarOf(ch)} size={36} />
                  ) : (
                    <ChannelAvatar provider={r.provider} size={36} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-bold">
                      <span className="truncate">{r.author || 'Unknown'}</span>
                      <span className="text-xs font-medium text-muted">
                        {providerMeta(r.provider).label}
                        {ch?.display_name ? ` · ${ch.display_name}` : ''}
                      </span>
                      <span className="text-xs text-faint">· {when(r.created_at)}</span>
                      {typeof r.like_count === 'number' && r.like_count > 0 ? (
                        <span className="text-xs text-faint">· {r.like_count} likes</span>
                      ) : null}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-soft">
                      {r.message}
                    </p>

                    {replied ? (
                      <div className="mt-2 rounded-xl bg-paper-dim px-3 py-2">
                        <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
                          Your reply
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-soft">{r.reply_text}</p>
                      </div>
                    ) : canReply ? (
                      replyFor === r.id ? (
                        <div className="mt-2 flex items-start gap-2">
                          <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={2}
                            placeholder={`Reply as ${ch?.display_name || providerMeta(r.provider).label}…`}
                            aria-label="Reply text"
                            className="field min-h-[52px] flex-1 resize-y !text-xs"
                            autoFocus
                          />
                          <div className="flex flex-col gap-1.5">
                            <button
                              type="button"
                              onClick={() => void reply(r)}
                              disabled={busyId === r.id || !draft.trim()}
                              className="btn btn-primary !px-3 !py-1.5 !text-xs"
                            >
                              {busyId === r.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
                              Send
                            </button>
                            <button
                              type="button"
                              onClick={() => { setReplyFor(null); setDraft(''); }}
                              className="btn btn-ghost !px-3 !py-1.5 !text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setReplyFor(r.id); setDraft(''); }}
                          className="mt-2 text-xs font-bold text-accent-ink transition hover:underline"
                        >
                          Reply
                        </button>
                      )
                    ) : (
                      <p className="mt-2 text-xs text-faint">
                        Replies not available on {providerMeta(r.provider).label} through Sosial.
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
        </>
      )}
    </div>
  );
}

function channelAvatarOf(c: ConnectedChannel): string | undefined {
  const md = (c.metadata ?? {}) as Record<string, unknown>;
  if (typeof md.avatar === 'string' && md.avatar) return md.avatar;
  if (typeof md.picture === 'string' && md.picture) return md.picture;
  return undefined;
}
