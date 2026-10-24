'use client';

/**
 * Messages tab — the unified DM inbox (p92). Reads conversations/messages
 * straight from Supabase (RLS: members of the workspace); sending goes
 * through the inbox-send edge function, which queues a send_message job the
 * worker executes through the platform adapter. The thread re-reads a few
 * seconds after a send so provider-assigned ids/timestamps land.
 *
 * Layout is a messenger: conversations on the left with the latest line as
 * a preview, the open chat on the right (day separators, grouped bubbles,
 * composer pinned to the bottom). Below lg the chat replaces the list.
 *
 * Not-DM channels (Threads, YouTube, LinkedIn, TikTok, Pinterest) get an
 * honest platform-honesty note instead of an empty mystery.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Link2, LoaderCircle, Lock, Mail, Send } from 'lucide-react';
import SafeImg from '@/components/SafeImg';
import {
  ChannelStrip, Face, InboxShell, PaneEmpty, Segmented, clock, dayLabel, composerText, errorBox, grow, isWide, paneFoot, paneHead, when,
} from '@/components/community/parts';
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

/** Latest line of each conversation, for the list preview. */
interface Preview {
  direction: 'in' | 'out';
  body: string;
  attachments: boolean;
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
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [chan, setChan] = useState<string>('all');
  const [order, setOrder] = useState<'new' | 'old'>('new');
  const [open, setOpen] = useState<ConversationRow | null>(null);
  const [msgs, setMsgs] = useState<MessageRow[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLTextAreaElement | null>(null);

  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  const dmChannels = useMemo(() => channels.filter((c) => DM_PROVIDERS.has(c.provider)), [channels]);
  const visibleConvs = useMemo(() => {
    const list = (convs ?? []).filter((c) => chan === 'all' || c.channel_id === chan);
    return order === 'new' ? list : [...list].reverse();
  }, [convs, chan, order]);
  // Channels whose provider refused DM reads (paid tier / scope). The worker
  // backs off, so say it here instead of showing a permanently empty inbox.
  const blockedNote = useMemo(() => {
    const blocked = dmChannels.filter((c) => c.metadata?.['dmBlocked'] === true);
    if (!blocked.length) return null;
    const names = blocked.map((c) => c.display_name || providerMeta(c.provider).label).join(', ');
    const why = blocked.map((c) => c.last_error).find(Boolean) ??
      'that account has not granted message access yet.';
    return `${names}: messages can't sync yet — ${why}`;
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
    const rows = (data ?? []) as ConversationRow[];
    setConvs(rows);
    if (error) setErr(error.message);
    if (!rows.length) return;
    // One read for every preview: newest first, first hit per conversation wins.
    const { data: last } = await sb
      .from('messages')
      .select('conversation_id,direction,body,attachments,sent_at')
      .in('conversation_id', rows.map((r) => r.id))
      .order('sent_at', { ascending: false })
      .limit(400);
    const next: Record<string, Preview> = {};
    for (const m of (last ?? []) as MessageRow[]) {
      if (next[m.conversation_id]) continue;
      next[m.conversation_id] = {
        direction: m.direction,
        body: m.body ?? '',
        attachments: (m.attachments ?? []).length > 0,
      };
    }
    setPreviews(next);
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

  const openConv = useCallback(
    async (c: ConversationRow) => {
      setOpen(c);
      setMsgs(null);
      setErr(null);
      setDraft('');
      await loadThread(c.id);
    },
    [loadThread],
  );

  // Desktop shows both panes: open the newest chat instead of an empty side.
  useEffect(() => {
    if (open || !visibleConvs.length || !isWide()) return;
    void openConv(visibleConvs[0]);
  }, [visibleConvs, open, openConv]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  // The keyboard opening shrinks the chat on a phone; keep the newest line
  // in view instead of letting it slide under the composer.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !open) return;
    const ro = new ResizeObserver(() => {
      el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

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
    grow(input.current);
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
      setDraft(text);
      setErr(e instanceof Error ? e.message : 'Could not send the message.');
    } finally {
      setBusy(false);
    }
  };

  const gate = (icon: ReactNode, title: string, body: string, href: string, cta: string) => (
    <div className="flex min-h-[420px] flex-col rounded-[var(--radius-card)] border border-line bg-card">
      <PaneEmpty
        icon={icon}
        title={title}
        action={
          <a href={href} className="btn btn-primary !px-4 !py-2 !text-xs">
            {cta}
          </a>
        }
      >
        {body}
      </PaneEmpty>
    </div>
  );

  if (!paid) {
    return gate(
      <Lock className="h-5 w-5" />,
      'Messages is a paid feature',
      'Read and reply to your Facebook, Instagram, X, Mastodon and Bluesky direct messages right from Sosial. Upgrade to unlock the Messages inbox.',
      '/pricing',
      'See plans',
    );
  }

  if (dmChannels.length === 0) {
    const anyChannels = channels.length > 0;
    return gate(
      <Link2 className="h-5 w-5" />,
      anyChannels ? 'No DM-capable channels yet' : 'No DM channels yet',
      anyChannels
        ? 'Your channels are connected, but none of them support reading direct messages. Connect Facebook, Instagram, X, Mastodon or Bluesky and their DMs show up here.'
        : 'Connect Facebook, Instagram, X, Mastodon or Bluesky in Connect, and their direct messages show up here.',
      '/connect',
      anyChannels ? 'Connect more channels' : 'Connect channels',
    );
  }

  /* ------------------------------ list pane ------------------------------ */

  const list = (
    <>
      <div className="space-y-2.5 border-b border-line px-4 pt-3.5 pb-3">
        <ChannelStrip channels={dmChannels} value={chan} onChange={setChan} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-faint">
            {convs ? `${visibleConvs.length} conversation${visibleConvs.length === 1 ? '' : 's'}` : 'Inbox'}
          </p>
          <Segmented
            label="Sort conversations"
            value={order}
            onChange={setOrder}
            options={[
              { value: 'new', label: 'Newest' },
              { value: 'old', label: 'Oldest' },
            ]}
          />
        </div>
        {blockedNote ? (
          <p className="rounded-xl bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted">{blockedNote}</p>
        ) : null}
      </div>
      {convs === null ? (
        <div className="flex flex-1 items-center justify-center">
          <LoaderCircle className="h-5 w-5 animate-spin text-faint" aria-hidden="true" />
        </div>
      ) : visibleConvs.length === 0 ? (
        <PaneEmpty
          icon={<Mail className="h-5 w-5" />}
          title={chan === 'all' ? 'No conversations yet' : 'No conversations on this channel yet'}
        >
          {chan === 'all'
            ? `When someone DMs ${dmChannels.map((c) => c.display_name || providerMeta(c.provider).label).join(', ')}, the conversation shows up here within a few minutes.`
            : 'Direct messages on this account show up here within a few minutes.'}
        </PaneEmpty>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-line-soft overflow-y-auto">
          {visibleConvs.map((c) => {
            const ch = channelById.get(c.channel_id);
            const unread = Math.max(0, Number(c.unread_count ?? 0));
            const on = open?.id === c.id;
            const p = previews[c.id];
            const line = p
              ? `${p.direction === 'out' ? 'You: ' : ''}${p.body || (p.attachments ? 'Sent an attachment' : '')}`
              : `via ${providerMeta(c.platform).label}${ch?.display_name ? ` · ${ch.display_name}` : ''}`;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => void openConv(c)}
                  aria-current={on ? 'true' : undefined}
                  className={`relative flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                    on ? 'bg-accent-soft' : 'hover:bg-surface'
                  }`}
                >
                  {on ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-accent" aria-hidden="true" /> : null}
                  <Face name={c.participant_name} avatar={c.participant_avatar} platform={c.platform} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`min-w-0 flex-1 truncate text-sm ${unread > 0 ? 'font-extrabold text-ink' : 'font-bold text-soft'}`}>
                        {c.participant_name || 'Unknown'}
                      </span>
                      <span className={`shrink-0 text-[11px] ${unread > 0 ? 'font-bold text-ink' : 'text-faint'}`}>
                        {when(c.last_message_at)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className={`min-w-0 flex-1 truncate text-[13px] ${unread > 0 ? 'text-ink' : 'text-muted'}`}>
                        {line}
                      </span>
                      {unread > 0 ? (
                        <span className="min-w-[18px] shrink-0 rounded-full bg-accent px-1.5 text-center text-[10px] font-extrabold leading-[18px] text-[#0b1220]">
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
      )}
    </>
  );

  /* ------------------------------ chat pane ------------------------------ */

  const chat = (() => {
    if (!open) {
      return (
        <PaneEmpty icon={<Mail className="h-5 w-5" />} title="Pick a conversation">
          Open a chat on the left to read it and reply.
        </PaneEmpty>
      );
    }
    const ch = channelById.get(open.channel_id);
    const sendAs = ch?.display_name || providerMeta(open.platform).label;
    return (
      <>
        <header className={paneHead}>
          <button
            type="button"
            onClick={() => {
              setOpen(null);
              setMsgs(null);
            }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-soft transition hover:bg-surface lg:hidden"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <Face name={open.participant_name} avatar={open.participant_avatar} platform={open.platform} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{open.participant_name || 'Unknown'}</p>
            <p className="truncate text-[11px] text-muted">
              {providerMeta(open.platform).label} · {sendAs}
            </p>
          </div>
        </header>
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-paper px-2.5 py-3 sm:px-5 sm:py-4">
          {msgs === null ? (
            <div className="py-10 text-center">
              <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-faint" aria-hidden="true" />
            </div>
          ) : msgs.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted">No messages in this thread yet.</p>
          ) : (
            msgs.map((m, i) => {
              const out = m.direction === 'out';
              const prev = msgs[i - 1];
              const next = msgs[i + 1];
              const newDay = !prev || new Date(prev.sent_at).toDateString() !== new Date(m.sent_at).toDateString();
              // Consecutive lines from one side sit tight and share one face.
              const joinPrev = !newDay && prev?.direction === m.direction;
              const joinNext =
                !!next &&
                next.direction === m.direction &&
                new Date(next.sent_at).toDateString() === new Date(m.sent_at).toDateString();
              return (
                <Fragment key={m.id}>
                  {newDay ? (
                    <div className="my-3 flex items-center gap-3 first:mt-0" role="separator">
                      <span className="h-px flex-1 bg-line" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-faint">{dayLabel(m.sent_at)}</span>
                      <span className="h-px flex-1 bg-line" />
                    </div>
                  ) : null}
                  <div className={`flex items-end gap-2 ${out ? 'justify-end' : 'justify-start'} ${joinPrev ? 'mt-0.5' : 'mt-2.5'}`}>
                    {!out ? (
                      joinNext ? (
                        <span className="w-7 shrink-0" aria-hidden="true" />
                      ) : (
                        <Face name={open.participant_name} avatar={open.participant_avatar} size={28} />
                      )
                    ) : null}
                    <div
                      className={`max-w-[82%] rounded-[20px] px-3 py-1.5 text-[15px] leading-snug sm:max-w-[68%] lg:px-3.5 lg:py-2 lg:text-sm lg:leading-relaxed ${
                        out
                          ? `bg-accent text-[#0b1220] ${joinNext ? '' : 'rounded-br-md'}`
                          : `border border-line-soft bg-card text-ink ${joinNext ? '' : 'rounded-bl-md'}`
                      } ${m.status === 'pending' ? 'opacity-70' : ''}`}
                      title={clock(m.sent_at)}
                    >
                      {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                      {(m.attachments ?? []).map((a, k) =>
                        a?.url ? (
                          <SafeImg
                            key={k}
                            src={a.url}
                            alt=""
                            width={220}
                            height={140}
                            className="mt-1 max-w-full rounded-lg object-cover sm:max-w-[240px]"
                          />
                        ) : null,
                      )}
                      {!joinNext || m.status === 'pending' ? (
                        <p className={`mt-0.5 text-[10px] ${out ? 'text-right text-[#0b1220]/60' : 'text-faint'}`}>
                          {clock(m.sent_at)}
                          {out && m.status === 'pending' ? ' · sending…' : ''}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Fragment>
              );
            })
          )}
        </div>
        {err ? <p className={`${errorBox} mx-3 mt-2`}>{err}</p> : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className={paneFoot}
        >
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-paper py-1.5 pr-1.5 pl-3.5 transition focus-within:border-accent">
            <textarea
              ref={input}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                grow(e.target);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder={`Message as ${sendAs}…`}
              aria-label="Message text"
              className={composerText}
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-[#0b1220] transition hover:bg-accent-bright disabled:opacity-40"
              aria-label="Send message"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </form>
      </>
    );
  })();

  return (
    <div className="space-y-3">
      {err && !open ? <p className={errorBox}>{err}</p> : null}
      <InboxShell list={list} detail={chat} detailOpen={!!open} />
    </div>
  );
}
