'use client';

/**
 * Messages tab — the unified DM inbox (p92). Reads conversations/messages
 * straight from Supabase (RLS: members of the workspace); sending goes
 * through the inbox-send edge function, which queues a send_message job the
 * worker executes through the platform adapter. The thread re-reads a few
 * seconds after a send so provider-assigned ids/timestamps land.
 *
 * Not-DM channels (Threads, YouTube, LinkedIn, TikTok, Pinterest) get an
 * honest platform-honesty note instead of an empty mystery.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, LoaderCircle, Lock, RefreshCw, Send, User } from 'lucide-react';
import SafeImg from '@/components/SafeImg';
import ChannelAvatar from '@/components/ChannelAvatar';
import { channelAvatar } from '@/lib/channelAvatar';
import { createClient } from '@/lib/supabase/client';
import { edgeErrorMessage } from '@/lib/functions';
import { providerMeta } from '@/lib/providers';
import type { ConnectedChannel } from '@/lib/types';

/** Phase-1 unified DM providers (capabilities.inbox). */
const DM_PROVIDERS = new Set(['facebook', 'instagram', 'x', 'mastodon', 'bluesky']);

interface ConversationRow {
  id: string;
  channel_id: string;
  platform: string;
  participant_name: string | null;
  participant_avatar: string | null;
  last_message_at: string | null;
  unread_count: number | null;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  external_id: string | null;
  direction: 'in' | 'out';
  body: string;
  attachments: { url: string }[];
  sent_at: string;
  status: string;
}

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Participant face when the platform gave an avatar url, initial bubble
 *  when it didn't (real-social parity). */
function FaceAvatar({
  name,
  avatar,
  size,
}: {
  name: string | null;
  avatar: string | null | undefined;
  size: number;
}) {
  const letter = (name ?? '').trim().charAt(0).toUpperCase();
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-paper text-soft"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {avatar ? (
        <SafeImg src={avatar} alt="" width={size} height={size} className="h-full w-full object-cover" />
      ) : letter ? (
        <span className="font-extrabold" style={{ fontSize: Math.round(size * 0.42) }}>{letter}</span>
      ) : (
        <User style={{ width: Math.round(size * 0.56), height: Math.round(size * 0.56) }} />
      )}
    </span>
  );
}

export default function MessagesInbox({
  workspaceId,
  channels,
  paid,
  reloadKey = 0,
  scanning = false,
  onRefresh,
}: {
  workspaceId: string;
  channels: ConnectedChannel[];
  paid: boolean;
  reloadKey?: number;
  scanning?: boolean;
  onRefresh?: () => void;
}) {
  const [convs, setConvs] = useState<ConversationRow[] | null>(null);
  const [chan, setChan] = useState<string>('all');
  const [order, setOrder] = useState<'new' | 'old'>('new');
  const [open, setOpen] = useState<ConversationRow | null>(null);
  const [msgs, setMsgs] = useState<MessageRow[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const dmChannels = useMemo(() => channels.filter((c) => DM_PROVIDERS.has(c.provider)), [channels]);
  const visibleConvs = useMemo(() => {
    const list = (convs ?? []).filter((c) => chan === 'all' || c.channel_id === chan);
    return order === 'new' ? list : [...list].reverse();
  }, [convs, chan, order]);
  // Connected channels that will never show up here, so the user knows why
  // the list looks shorter than the channel row.
  const noDmNote = useMemo(() => {
    const provs = [...new Set(channels.filter((c) => !DM_PROVIDERS.has(c.provider)).map((c) => c.provider))];
    if (!provs.length) return null;
    const names = provs.map((p) => providerMeta(p).label);
    return names.length > 1
      ? `${names.join(' and ')} don't expose a messages API — those conversations stay in their own apps.`
      : `${names[0]} doesn't expose a messages API, you won't find its conversations here.`;
  }, [channels]);

  // Channels whose provider refused DM reads (paid tier / scope). The worker
  // backs off, so say it here instead of showing a permanently empty inbox.
  const blockedNote = useMemo(() => {
    const blocked = dmChannels.filter((c) => c.metadata?.['dmBlocked'] === true);
    if (!blocked.length) return null;
    const names = blocked.map((c) => c.display_name || providerMeta(c.provider).label).join(', ');
    const why = blocked.map((c) => c.last_error).find(Boolean) ??
      'that account has not granted message access yet.';
    return `${names}: messages can't sync yet \u2014 ${why}`;
  }, [dmChannels]);

  const loadConvs = useCallback(async () => {
    setErr(null);
    const sb = createClient();
    const { data, error } = await sb
      .from('conversations')
      .select('id,channel_id,platform,participant_name,participant_avatar,last_message_at,unread_count')
      .eq('workspace_id', workspaceId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(100);
    setConvs((data ?? []) as ConversationRow[]);
    if (error) setErr(error.message);
  }, [workspaceId]);

  const loadThread = useCallback(async (cid: string) => {
    const sb = createClient();
    const { data } = await sb
      .from('messages')
      .select('id,conversation_id,external_id,direction,body,attachments,sent_at,status')
      .eq('conversation_id', cid)
      .order('sent_at', { ascending: true })
      .limit(500);
    setMsgs((data ?? []) as MessageRow[]);
  }, []);

  useEffect(() => {
    if (!paid || dmChannels.length === 0) return;
    void loadConvs();
  }, [paid, dmChannels.length, loadConvs, reloadKey]);

  const openConv = async (c: ConversationRow) => {
    setOpen(c);
    setMsgs(null);
    setErr(null);
    await loadThread(c.id);
  };

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  // Shared sweep from the tab host reloads the list and the open thread.
  useEffect(() => {
    if (reloadKey === 0) return;
    void loadConvs();
    if (open) void loadThread(open.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !open || busy) return;
    setBusy(true);
    setErr(null);
    const optimistic: MessageRow = {
      id: `local:${Date.now()}`,
      conversation_id: open.id,
      external_id: null,
      direction: 'out',
      body: text,
      attachments: [],
      sent_at: new Date().toISOString(),
      status: 'pending',
    };
    setMsgs((m) => [...(m ?? []), optimistic]);
    setDraft('');
    try {
      const sb = createClient();
      const { data, error } = await sb.functions.invoke('inbox-send', {
        body: { conversation_id: open.id, text },
      });
      if (error) {
        const detail = await edgeErrorMessage(error);
        throw new Error(detail ?? error.message);
      }
      // inbox-send answers 200 for business refusals too (plan gate, capped
      // text, provider not supported); only `ok:false` means nothing queued.
      const res = data as { ok?: boolean; error?: string } | null;
      if (res && res.ok === false) {
        throw new Error(res.error ?? 'Could not queue the message.');
      }
      // The worker sends on the platform async; poll briefly for the stored
      // (provider-id'd) message instead of trusting one fixed sleep.
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        await loadThread(open.id);
        await loadConvs();
      }
    } catch (e) {
      setMsgs((m) => (m ?? []).filter((x) => x.id !== optimistic.id));
      setErr(e instanceof Error ? e.message : 'Could not send the message.');
    } finally {
      setBusy(false);
    }
  };

  if (!paid) {
    return (
      <div className="rounded-2xl border border-line bg-card p-10 text-center">
        <Lock className="mx-auto h-6 w-6 text-faint" aria-hidden="true" />
        <p className="mt-2 text-sm font-bold">Messages is a paid feature</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
          Read and reply to your Facebook, Instagram, X, Mastodon and Bluesky
          direct messages right from Sosial. Upgrade to unlock the Messages inbox.
        </p>
        <a href="/pricing" className="btn btn-primary mt-4 !px-4 !py-2 !text-xs">
          See plans
        </a>
      </div>
    );
  }

  if (dmChannels.length === 0) {
    const anyChannels = channels.length > 0;
    return (
      <div className="rounded-2xl border border-line bg-card p-10 text-center">
        <p className="text-sm font-bold">
          {anyChannels ? 'No DM-capable channels yet' : 'No DM channels yet'}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
          {anyChannels
            ? 'Your channels are connected, but none of them support reading direct messages. Connect Facebook, Instagram, X, Mastodon or Bluesky and their DMs show up here.'
            : 'Connect Facebook, Instagram, X, Mastodon or Bluesky in Connect, and their direct messages show up here.'}
        </p>
        <a href="/connect" className="btn btn-primary mt-4 !px-4 !py-2 !text-xs">
          {anyChannels ? 'Connect more channels' : 'Connect channels'}
        </a>
      </div>
    );
  }

  if (open) {
    const ch = channelById.get(open.channel_id);
    const sendAs = ch?.display_name || providerMeta(open.platform).label;
    return (
      <div className="rounded-2xl border border-line bg-card">
        {/* Chat header: partner face, handle, channel tag — messenger parity */}
        <div className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
          <button
            type="button"
            onClick={() => { setOpen(null); setMsgs(null); }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:bg-bone"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <FaceAvatar
            name={open.participant_name}
            avatar={open.participant_avatar}
            size={32}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{open.participant_name || 'Unknown'}</p>
            <p className="text-[11px] text-muted">{sendAs}</p>
          </div>
          <span className="shrink-0 rounded-full bg-paper-dim px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-soft">
            {providerMeta(open.platform).label}
          </span>
        </div>
        <div ref={scroller} className="max-h-[440px] space-y-1.5 overflow-y-auto px-3 py-3">
          {msgs === null ? (
            <div className="py-8 text-center">
              <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-faint" aria-hidden="true" />
            </div>
          ) : msgs.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">No messages in this thread yet.</p>
          ) : (
            msgs.map((m) => {
              const out = m.direction === 'out';
              return (
                <div key={m.id} className={`flex items-end gap-2 ${out ? 'justify-end' : 'justify-start'}`}>
                  {!out ? (
                    <FaceAvatar
                      name={open.participant_name}
                      avatar={open.participant_avatar}
                      size={24}
                    />
                  ) : null}
                  <div
                    className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      out
                        ? 'rounded-br-md bg-accent font-medium text-[#0b1220]'
                        : 'rounded-bl-md border border-line-soft bg-paper text-soft'
                    }`}
                  >
                    {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                    {(m.attachments ?? []).map((a, i) =>
                      a?.url ? (
                        <SafeImg
                          key={i}
                          src={a.url}
                          alt=""
                          width={220}
                          height={140}
                          className="mt-1 max-w-[220px] rounded-lg border border-line-soft object-cover"
                        />
                      ) : null,
                    )}
                    <p className={`mt-0.5 text-[10px] text-faint ${out ? 'text-right' : ''}`}>
                      {when(m.sent_at)}
                      {out && m.status === 'pending' ? ' · sending…' : ''}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {err ? (
          <p className="mx-3 mb-2 rounded-xl bg-[#FDEBEC] px-3 py-2 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">{err}</p>
        ) : null}
        <div className="flex items-end gap-2 border-t border-line px-3 py-2.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder={`Reply as ${sendAs}…`}
            aria-label="Message text"
            className="field min-h-[44px] flex-1 resize-y !text-xs"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || !draft.trim()}
            className="btn btn-primary !px-3 !py-2"
            aria-label="Send message"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="px-1 text-xs font-bold uppercase tracking-wide text-faint">Inbox</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-full border border-line bg-card p-0.5" role="group" aria-label="Sort conversations">
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
            onClick={() => onRefresh?.()}
            disabled={scanning || !onRefresh}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-bold text-soft transition hover:bg-paper disabled:opacity-50"
            aria-label="Refresh conversations"
          >
            {scanning ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            Refresh
          </button>
        </div>
      </div>
      {dmChannels.length > 1 ? (
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
          {dmChannels.map((c) => {
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
      ) : null}
      {noDmNote ? (
        <p className="rounded-xl bg-paper-dim px-3.5 py-2.5 text-xs leading-relaxed text-muted">{noDmNote}</p>
      ) : null}
      {blockedNote ? (
        <p className="rounded-xl bg-paper-dim px-3.5 py-2.5 text-xs leading-relaxed text-muted">{blockedNote}</p>
      ) : null}
      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">{err}</p>
      ) : null}
      {convs === null ? (
        <div className="rounded-2xl border border-line bg-card p-10 text-center text-sm text-muted">
          <LoaderCircle className="mx-auto h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : visibleConvs.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-10 text-center">
          <p className="text-sm font-bold">
            {chan === 'all' ? 'No conversations yet' : 'No conversations on this channel yet'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            {chan === 'all'
              ? `When someone DMs ${dmChannels.map((c) => c.display_name || providerMeta(c.provider).label).join(', ')}, the conversation shows up here within a few minutes.`
              : 'Direct messages on this account show up here within a few minutes.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visibleConvs.map((c) => {
            const ch = channelById.get(c.channel_id);
            const unread = Math.max(0, Number(c.unread_count ?? 0));
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => void openConv(c)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-3 text-left transition hover:bg-paper-dim"
                >
                  <FaceAvatar
                    name={c.participant_name}
                    avatar={c.participant_avatar}
                    size={38}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`min-w-0 truncate text-sm ${unread > 0 ? 'font-extrabold' : 'font-bold'}`}>
                        {c.participant_name || 'Unknown'}
                      </span>
                      <span className="shrink-0 text-xs text-faint">{when(c.last_message_at)}</span>
                      {unread > 0 ? (
                        <span className="ml-auto shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-extrabold text-[#0b1220]">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
                      <span>via</span>
                      <ChannelAvatar provider={c.platform} size={14} />
                      <span className="truncate">
                        {providerMeta(c.platform).label}
                        {ch?.display_name ? ` · ${ch.display_name}` : ''}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function avatarOf(c: ConnectedChannel): string | undefined {
  const md = (c.metadata ?? {}) as Record<string, unknown>;
  if (typeof md.avatar === 'string' && md.avatar) return md.avatar;
  if (typeof md.picture === 'string' && md.picture) return md.picture;
  return undefined;
}
