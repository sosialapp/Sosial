'use client';

/**
 * Comments tab — the unified comment feed (p92). Reads the `comments`
 * table (RLS: workspace members) and renders real-social cards:
 * commenter avatar up front, handle + channel + time on the first line,
 * message aligned under the handle. Replies queue through reply-comment
 * and flip the card to "replied" once the worker posts them.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LoaderCircle, MessageCircle, RefreshCw, Send } from 'lucide-react';
import SafeImg from '@/components/SafeImg';
import ChannelAvatar from '@/components/ChannelAvatar';
import { channelAvatar } from '@/lib/channelAvatar';
import { createClient } from '@/lib/supabase/client';
import { edgeErrorMessage } from '@/lib/functions';
import { providerMeta } from '@/lib/providers';
import type { ConnectedChannel } from '@/lib/types';

interface CommentRow {
  id: string;
  channel_id: string;
  platform: string;
  external_post_id: string | null;
  parent_external_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  body: string;
  created_at: string;
  status: string;
}

/** Providers the sync engine can reply on (phase 1). */
const REPLY_PROVIDERS = new Set(['facebook', 'instagram', 'x', 'mastodon', 'bluesky']);
const NO_REPLY_TEXT: Record<string, string> = {
  threads: 'Unified comments for Threads are coming in the next release.',
  youtube: 'Replies for YouTube are planned.',
  linkedin: 'Replies for LinkedIn are planned.',
  tiktok: 'Replies for TikTok are planned.',
  pinterest: 'Replies are not exposed by the Pinterest API.',
};

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

/** Commenter face: platform avatar when known, initial bubble when not. */
function CommentFace({ name, avatar }: { name: string | null; avatar: string | null }) {
  const letter = (name ?? '').trim().replace('@', '').charAt(0).toUpperCase();
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-paper text-soft"
      style={{ width: 34, height: 34 }}
      aria-hidden="true"
    >
      {avatar ? (
        <SafeImg src={avatar} alt="" width={34} height={34} className="h-full w-full object-cover" />
      ) : letter ? (
        <span className="text-sm font-extrabold">{letter}</span>
      ) : (
        <MessageCircle className="h-4 w-4" />
      )}
    </span>
  );
}

export default function CommentsFeed({
  channels,
  workspaceId,
}: {
  channels: ConnectedChannel[];
  workspaceId: string;
}) {
  const [rows, setRows] = useState<CommentRow[] | null>(null);
  const [chan, setChan] = useState<string>('all');
  const [order, setOrder] = useState<'new' | 'old'>('new');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data, error } = await sb
      .from('comments')
      .select('id,channel_id,platform,external_post_id,parent_external_id,author_name,author_avatar,body,created_at,status')
      .order('created_at', { ascending: false })
      .limit(200);
    setRows((data ?? []) as CommentRow[]);
    if (error) setErr(error.message);
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** Ask for a fresh unified sweep, then re-read. scan-now dedupes per
   *  workspace per minute server-side. */
  const refresh = async () => {
    setScanning(true);
    setErr(null);
    setNote(null);
    try {
      const sb = createClient();
      const { error } = await sb.functions.invoke('scan-now', {
        body: { workspace_id: workspaceId },
      });
      if (error) {
        const detail = await edgeErrorMessage(error);
        throw new Error(detail ?? error.message);
      }
      // Jobs claim within seconds; two beats, then read whatever landed.
      await new Promise((r) => setTimeout(r, 8000));
      await load();
      setNote('Refreshed — newest comments and messages are in.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start the refresh.');
    } finally {
      setScanning(false);
    }
  };

  const reply = async (row: CommentRow) => {
    const text = draft.trim();
    if (!text || busyId) return;
    setBusyId(row.id);
    setErr(null);
    setNote(null);
    try {
      const sb = createClient();
      const { error } = await sb.functions.invoke('reply-comment', {
        body: { comment_id: row.id, text },
      });
      if (error) {
        const detail = await edgeErrorMessage(error);
        throw new Error(detail ?? error.message);
      }
      setReplyFor(null);
      setDraft('');
      setNote(`Reply queued for ${providerMeta(row.platform).label} — it posts in a few seconds.`);
      // The worker flips status to replied async; pull the fresh row.
      await new Promise((r) => setTimeout(r, 6000));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send the reply.');
    } finally {
      setBusyId(null);
    }
  };

  const channelsWithRows = useMemo(() => {
    const ids = new Set((rows ?? []).map((r) => r.channel_id));
    return channels.filter((c) => ids.has(c.id));
  }, [channels, rows]);
  const visible = useMemo(() => {
    const list = (rows ?? []).filter((r) => chan === 'all' || r.channel_id === chan);
    return order === 'new'
      ? list
      : [...list].reverse();
  }, [rows, chan, order]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter by channel">
          <button
            type="button"
            onClick={() => setChan('all')}
            aria-pressed={chan === 'all'}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              chan === 'all' ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card text-muted hover:bg-paper'
            }`}
          >
            All channels
          </button>
          {channelsWithRows.map((c) => {
            const on = chan === c.id;
            const name = c.display_name || providerMeta(c.provider).label;
            const handle = c.handle ? (c.handle.startsWith('@') ? c.handle : `@${c.handle}`) : null;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setChan(on ? 'all' : c.id)}
                aria-pressed={on}
                title={`${name}${handle ? ` ${handle}` : ''} - ${providerMeta(c.provider).label}`}
                className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-left transition ${
                  on ? 'border-accent bg-accent' : 'border-line bg-card hover:bg-paper'
                }`}
              >
                <ChannelAvatar provider={c.provider} avatar={channelAvatar(c.metadata)} size={28} />
                <span className="flex min-w-0 max-w-40 flex-col leading-tight">
                  <span className={`truncate text-xs font-bold ${on ? 'text-on-accent' : 'text-soft'}`}>{name}</span>
                  {handle ? (
                    <span className={`truncate text-[10px] ${on ? 'text-on-accent/70' : 'text-faint'}`}>{handle}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-full border border-line bg-card p-0.5" role="group" aria-label="Sort comments">
            {(['new', 'old'] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOrder(o)}
                aria-pressed={order === o}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  order === o ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'
                }`}
              >
                {o === 'new' ? 'Newest' : 'Oldest'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={scanning}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-bold text-soft transition hover:bg-paper disabled:opacity-50"
          >
            {scanning ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            Refresh
          </button>
        </div>
      </div>

      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">{err}</p>
      ) : null}
      {note ? (
        <p className="rounded-xl bg-[#EDF3EC] px-3.5 py-2.5 text-xs font-bold text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]">{note}</p>
      ) : null}

      {rows === null ? (
        <div className="rounded-2xl border border-line bg-card p-10 text-center text-sm text-muted">
          <LoaderCircle className="mx-auto h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-10 text-center">
          <MessageCircle className="mx-auto h-6 w-6 text-faint" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold">{chan === 'all' ? 'No comments yet' : 'No comments on this channel yet'}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            {chan === 'all'
              ? 'Publish to your channels, get a comment, and it lands here when the engine sweeps - every 5 minutes or on Refresh.'
              : 'Comments on this account land here when the engine sweeps - every 5 minutes or on Refresh.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((r) => {
            const ch = channelById.get(r.channel_id);
            const isReply = !!r.parent_external_id;
            const canReply = REPLY_PROVIDERS.has(r.platform);
            const noReply = NO_REPLY_TEXT[r.platform];
            const replied = r.status === 'replied' || r.status === 'hidden' || r.status === 'deleted';
            return (
              <li key={r.id} className={`rounded-2xl border border-line bg-card p-3.5 ${isReply ? 'ml-4 sm:ml-8' : ''}`}>
                <div className="flex items-start gap-3">
                  <CommentFace name={r.author_name} avatar={r.author_avatar} />
                  <div className="min-w-0 flex-1">
                    {/* Top row: handle · channel · time */}
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                      <span className="min-w-0 truncate text-sm font-bold">{r.author_name || 'Unknown'}</span>
                      <span className="shrink-0 text-[11px] text-muted">
                        via {providerMeta(r.platform).label}
                        {ch?.display_name ? ` · ${ch.display_name}` : ''}
                      </span>
                      <span className="shrink-0 text-[11px] text-faint">· {when(r.created_at)}</span>
                      {r.status === 'new' ? (
                        <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-[#0b1220]">
                          New
                        </span>
                      ) : replied ? (
                        <span className="shrink-0 rounded-full bg-paper-dim px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-muted">
                          {r.status === 'replied' ? 'Replied' : r.status === 'hidden' ? 'Hidden' : 'Deleted'}
                        </span>
                      ) : null}
                    </p>
                    {/* Comment body aligned under the handle */}
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-soft">
                      {r.body || '(empty comment)'}
                    </p>

                    {replied ? null : canReply ? (
                      replyFor === r.id ? (
                        <div className="mt-2 flex items-start gap-2">
                          <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={2}
                            placeholder={`Reply as ${ch?.display_name || providerMeta(r.platform).label}…`}
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
                      <p className="mt-2 text-xs text-faint">{noReply ?? 'Replies not available on this platform.'}</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
