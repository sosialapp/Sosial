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
import { ArrowLeft, LoaderCircle, Lock, Search, Send, User } from 'lucide-react';
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

/** Quick replies: one tap drops the text into the composer, never sends. */
const QUICK_REPLIES = ['Thanks for reaching out', 'We are looking into it'];

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yest = new Date();
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
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
}: {
  workspaceId: string;
  channels: ConnectedChannel[];
  paid: boolean;
  reloadKey?: number;
}) {
  const [convs, setConvs] = useState<ConversationRow[] | null>(null);
  const [chan, setChan] = useState<string>('all');
  const [order, setOrder] = useState<'new' | 'old'>('new');
  const [open, setOpen] = useState<ConversationRow | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [q, setQ] = useState('');
  /** Below the lg breakpoint list and chat are separate screens. */
  const [mobileChat, setMobileChat] = useState(false);
  const autoOpened = useRef(false);
  const [msgs, setMsgs] = useState<MessageRow[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const dmChannels = useMemo(() => channels.filter((c) => DM_PROVIDERS.has(c.provider)), [channels]);
  const visibleConvs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (convs ?? []).filter(
      (c) =>
        (chan === 'all' || c.channel_id === chan) &&
        (!onlyUnread || Number(c.unread_count ?? 0) > 0) &&
        (!needle || (c.participant_name ?? '').toLowerCase().includes(needle)),
    );
    return order === 'new' ? list : [...list].reverse();
  }, [convs, chan, order, onlyUnread, q]);
  const unreadTotal = useMemo(
    () => (convs ?? []).reduce((n, c) => n + (Number(c.unread_count ?? 0) > 0 ? 1 : 0), 0),
    [convs],
  );
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

  // On a wide screen the chat pane is always visible, so open the newest
  // conversation once instead of showing an empty pane.
  useEffect(() => {
    if (autoOpened.current || open || !convs || visibleConvs.length === 0) return;
    autoOpened.current = true;
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      void openConv(visibleConvs[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convs, visibleConvs, open]);

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

  const openCh = open ? channelById.get(open.channel_id) : undefined;
  const sendAs = open ? openCh?.display_name || providerMeta(open.platform).label : '';

  const channelChips =
    dmChannels.length > 1 ? (
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter by channel">
        <button
          type="button"
          onClick={() => setChan('all')}
          aria-pressed={chan === 'all'}
          className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${
            chan === 'all' ? 'border-ink bg-ink text-bone' : 'border-line bg-card text-muted hover:bg-surface'
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
                on ? 'border-accent bg-accent' : 'border-line bg-card hover:bg-surface'
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
    ) : (
      <span />
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {channelChips}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-full border border-line bg-card p-0.5" role="group" aria-label="Filter conversations">
            <button
              type="button"
              onClick={() => setOnlyUnread(true)}
              aria-pressed={onlyUnread}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                onlyUnread ? 'bg-accent/25 text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              Unread{unreadTotal > 0 ? ` · ${unreadTotal}` : ''}
            </button>
            <button
              type="button"
              onClick={() => setOnlyUnread(false)}
              aria-pressed={!onlyUnread}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                !onlyUnread ? 'bg-accent/25 text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              All
            </button>
          </div>
          <div className="flex items-center gap-0.5 rounded-full border border-line bg-card p-0.5" role="group" aria-label="Sort conversations">
            {(['new', 'old'] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOrder(o)}
                aria-pressed={order === o}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  order === o ? 'bg-accent/25 text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {o === 'new' ? 'Newest' : 'Oldest'}
              </button>
            ))}
          </div>
        </div>
      </div>

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
      ) : convs.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-10 text-center">
          <p className="text-sm font-bold">No conversations yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            {`When someone DMs ${dmChannels.map((c) => c.display_name || providerMeta(c.provider).label).join(', ')}, the conversation shows up here within a few minutes.`}
          </p>
        </div>
      ) : (
        <div className="flex overflow-hidden rounded-3xl border border-line bg-card lg:h-[calc(100vh-17rem)] lg:min-h-[560px]">
          {/* Conversations */}
          <aside
            aria-label="Conversations"
            className={`${mobileChat ? 'hidden' : 'flex'} min-w-0 w-full flex-col lg:flex lg:w-[340px] lg:shrink-0 lg:border-r lg:border-line-soft`}
          >
            <label className="flex items-center gap-2 border-b border-line-soft px-4 py-3 text-muted">
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">Search conversations</span>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search conversations"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
              />
            </label>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {visibleConvs.length === 0 ? (
                <li className="px-4 py-10 text-center text-xs text-muted">
                  {onlyUnread ? 'No unread conversations.' : chan === 'all' ? 'No conversations match.' : 'No conversations on this channel yet.'}
                </li>
              ) : null}
              {visibleConvs.map((c) => {
                const ch = channelById.get(c.channel_id);
                const unread = Math.max(0, Number(c.unread_count ?? 0));
                const on = open?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => {
                        setMobileChat(true);
                        void openConv(c);
                      }}
                      className={`flex w-full items-center gap-3 border-b border-line-soft px-4 py-3.5 text-left transition ${
                        on ? 'bg-accent/15' : 'hover:bg-surface'
                      }`}
                    >
                      <span className="relative inline-flex shrink-0">
                        <FaceAvatar name={c.participant_name} avatar={c.participant_avatar} size={44} />
                        <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-card">
                          <ChannelAvatar provider={c.platform} size={20} />
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={`min-w-0 flex-1 truncate text-sm ${unread > 0 ? 'font-extrabold' : 'font-bold'}`}>
                            {c.participant_name || 'Unknown'}
                          </span>
                          <span className="shrink-0 text-xs text-muted">{when(c.last_message_at)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-xs text-muted">
                            {providerMeta(c.platform).label}
                            {ch?.display_name ? ` · ${ch.display_name}` : ''}
                          </span>
                          {unread > 0 ? (
                            <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-extrabold text-[#0b1220]">
                              {unread > 9 ? '9+' : unread}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Chat */}
          <section
            aria-label="Conversation"
            className={`${mobileChat ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 flex-col lg:flex`}
          >
            {open ? (
              <>
                <div className="flex items-center gap-2.5 border-b border-line-soft px-3 py-2.5 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setMobileChat(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:bg-surface lg:hidden"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="relative inline-flex shrink-0">
                    <FaceAvatar name={open.participant_name} avatar={open.participant_avatar} size={40} />
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-card">
                      <ChannelAvatar provider={open.platform} size={18} />
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{open.participant_name || 'Unknown'}</p>
                    <p className="truncate text-[11px] text-muted">
                      {providerMeta(open.platform).label} · replying as {sendAs}
                    </p>
                  </div>
                </div>

                <div ref={scroller} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-4 sm:px-5">
                  {msgs === null ? (
                    <div className="py-8 text-center">
                      <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-faint" aria-hidden="true" />
                    </div>
                  ) : msgs.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted">No messages in this thread yet.</p>
                  ) : (
                    msgs.map((m, idx) => {
                      const out = m.direction === 'out';
                      const showDay =
                        idx === 0 ||
                        new Date(m.sent_at).toDateString() !== new Date(msgs[idx - 1].sent_at).toDateString();
                      return (
                        <div key={m.id}>
                          {showDay ? (
                            <p className="my-3 text-center text-[11px] font-bold text-muted">{dayLabel(m.sent_at)}</p>
                          ) : null}
                          <div className={`flex items-end gap-2 ${out ? 'justify-end' : 'justify-start'}`}>
                            {!out ? (
                              <FaceAvatar name={open.participant_name} avatar={open.participant_avatar} size={24} />
                            ) : null}
                            <div
                              className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                                out
                                  ? 'rounded-br-md bg-accent font-medium text-[#0b1220]'
                                  : 'rounded-bl-md bg-surface text-ink'
                              } ${out && m.status === 'pending' ? 'opacity-70' : ''}`}
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
                              <p className={`mt-0.5 text-[10px] ${out ? 'text-right text-[#0b1220]/60' : 'text-muted'}`}>
                                {when(m.sent_at)}
                                {out && m.status === 'pending' ? ' · sending…' : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-line-soft px-4 pb-4 pt-3 sm:px-5">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-muted">Quick replies</span>
                    {QUICK_REPLIES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDraft(t)}
                        className="rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-soft transition hover:bg-surface"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-end gap-2 rounded-2xl border border-line bg-paper p-2 transition focus-within:border-accent/70">
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
                      className="block min-h-[44px] flex-1 resize-none bg-transparent px-1.5 py-1 text-sm leading-relaxed text-soft outline-none placeholder:text-faint"
                    />
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={busy || !draft.trim()}
                      className="btn btn-primary !px-3 !py-2 disabled:opacity-40"
                      aria-label="Send message"
                    >
                      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-10 text-center text-sm text-muted">
                Select a conversation to read and reply.
              </div>
            )}
          </section>

          {/* Details */}
          {open ? (
            <aside
              aria-label="Conversation details"
              className="hidden w-[280px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-line-soft p-5 xl:flex"
            >
              <div className="flex flex-col items-center gap-1.5 text-center">
                <span className="relative inline-flex">
                  <FaceAvatar name={open.participant_name} avatar={open.participant_avatar} size={64} />
                  <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-card">
                    <ChannelAvatar provider={open.platform} size={24} />
                  </span>
                </span>
                <p className="mt-1 text-[15px] font-extrabold">{open.participant_name || 'Unknown'}</p>
                <p className="text-xs text-muted">{providerMeta(open.platform).label}</p>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2.5 text-xs">
                <dt className="text-muted">Channel</dt>
                <dd className="truncate text-right font-bold">{sendAs}</dd>
                {msgs && msgs.length > 0 ? (
                  <>
                    <dt className="text-muted">Started</dt>
                    <dd className="text-right font-bold">{dayLabel(msgs[0].sent_at)}</dd>
                    <dt className="text-muted">Messages</dt>
                    <dd className="text-right font-bold">{msgs.length}</dd>
                  </>
                ) : null}
                <dt className="text-muted">Status</dt>
                <dd className="text-right font-bold">{Number(open.unread_count ?? 0) > 0 ? 'Unread' : 'Read'}</dd>
              </dl>
            </aside>
          ) : null}
        </div>
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
