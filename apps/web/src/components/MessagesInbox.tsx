'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, LoaderCircle, Lock, Send } from 'lucide-react';
import ChannelAvatar from '@/components/ChannelAvatar';
import {
  fetchConversations,
  fetchThread,
  sendDirectMessage,
  InboxConversation,
  InboxMessage,
} from '@/lib/inbox';
import { providerMeta } from '@/lib/providers';
import type { ConnectedChannel } from '@/lib/types';

const DM_PROVIDERS = new Set(['facebook', 'instagram', 'mastodon']);

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

/**
 * Messages tab: live DM conversations through the stateless inbox-fetch /
 * inbox-send edge functions (Facebook Messenger, Instagram DM, Mastodon).
 * Paid plans only — the gate is enforced server-side; free sees an upgrade
 * card here.
 */
export default function MessagesInbox({
  workspaceId,
  channels,
  paid,
}: {
  workspaceId: string;
  channels: ConnectedChannel[];
  paid: boolean;
}) {
  const [convs, setConvs] = useState<InboxConversation[] | null>(null);
  const [open, setOpen] = useState<InboxConversation | null>(null);
  const [msgs, setMsgs] = useState<InboxMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  const dmChannels = useMemo(() => channels.filter((c) => DM_PROVIDERS.has(c.provider)), [channels]);

  const loadConvs = useCallback(async () => {
    setErr(null);
    try {
      const list = await fetchConversations(workspaceId);
      setConvs(list);
    } catch (e) {
      setConvs([]);
      setErr(e instanceof Error ? e.message : 'Could not load conversations.');
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!paid || dmChannels.length === 0) return;
    void loadConvs();
  }, [paid, dmChannels.length, loadConvs]);

  const openConv = async (c: InboxConversation) => {
    setOpen(c);
    setMsgs(null);
    setErr(null);
    try {
      const list = await fetchThread(workspaceId, c);
      setMsgs(list);
    } catch (e) {
      setMsgs([]);
      setErr(e instanceof Error ? e.message : 'Could not load the conversation.');
    }
  };

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !open || busy) return;
    setBusy(true);
    setErr(null);
    const optimistic: InboxMessage = {
      provider: open.provider,
      channel_id: open.channel_id,
      conversation_id: open.id,
      id: `local:${Date.now()}`,
      text,
      from_me: true,
      from_name: null,
      ts: new Date().toISOString(),
    };
    setMsgs((m) => [...(m ?? []), optimistic]);
    setDraft('');
    try {
      await sendDirectMessage(workspaceId, open, text);
      // Refresh the thread so ids and ordering come from the provider.
      const list = await fetchThread(workspaceId, open);
      setMsgs(list.length ? list : [optimistic]);
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
          Read and reply to your Facebook, Instagram and Mastodon direct messages
          right from Sosial. Upgrade to unlock the Messages inbox.
        </p>
        <a href="/pricing" className="btn btn-primary mt-4 !px-4 !py-2 !text-xs">
          See plans
        </a>
      </div>
    );
  }

  if (dmChannels.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-card p-10 text-center">
        <p className="text-sm font-bold">No DM channels yet</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
          Connect a Facebook Page, an Instagram business account or Mastodon in
          Connect, and their direct messages show up here.
        </p>
        <a href="/connect" className="btn btn-primary mt-4 !px-4 !py-2 !text-xs">
          Connect channels
        </a>
      </div>
    );
  }

  if (open) {
    const ch = channels.find((c) => c.id === open.channel_id);
    return (
      <div className="rounded-2xl border border-line bg-card">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <button
            type="button"
            onClick={() => { setOpen(null); setMsgs(null); }}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-soft transition hover:bg-paper-dim"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back
          </button>
          <ChannelAvatar provider={open.provider} avatar={ch ? avatarOf(ch) : undefined} size={26} />
          <p className="min-w-0 flex-1 truncate text-sm font-bold">{open.title}</p>
          <span className="text-xs text-faint">{providerMeta(open.provider).label}</span>
        </div>
        <div ref={scroller} className="max-h-[420px] space-y-2 overflow-y-auto px-3 py-3">
          {msgs === null ? (
            <div className="py-8 text-center">
              <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-faint" aria-hidden="true" />
            </div>
          ) : msgs.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">No messages loaded yet.</p>
          ) : (
            msgs.map((m) => (
              <div key={m.id} className={`flex ${m.from_me ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.from_me
                      ? 'rounded-br-md bg-accent text-[#0b1220] font-medium'
                      : 'rounded-bl-md bg-paper-dim text-soft'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={`mt-0.5 text-[10px] ${m.from_me ? 'text-right' : ''} text-faint`}>
                    {when(m.ts)}
                  </p>
                </div>
              </div>
            ))
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
            placeholder={`Reply as ${ch?.display_name ?? providerMeta(open.provider).label}…`}
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
      {err ? (
        <p className="rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">{err}</p>
      ) : null}
      {warn ? (
        <p className="rounded-xl bg-[#FFF6E5] px-3.5 py-2.5 text-xs font-bold text-[#8a6116] dark:bg-[#2b2314] dark:text-[#e7c886]">{warn}</p>
      ) : null}
      {convs === null ? (
        <div className="rounded-2xl border border-line bg-card p-10 text-center text-sm text-muted">
          <LoaderCircle className="mx-auto h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : convs.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-10 text-center">
          <p className="text-sm font-bold">No conversations yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            When someone DMs {dmChannels.map((c) => c.display_name || providerMeta(c.provider).label).join(', ')},
            the conversation shows up here live.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {convs.map((c) => {
            const ch = channels.find((x) => x.id === c.channel_id);
            return (
              <li key={`${c.provider}:${c.channel_id}:${c.id}`}>
                <button
                  type="button"
                  onClick={() => void openConv(c)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-4 text-left transition hover:bg-paper-dim"
                >
                  <ChannelAvatar provider={c.provider} avatar={ch ? avatarOf(ch) : undefined} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 truncate text-sm font-bold">{c.title}</span>
                      <span className="shrink-0 text-xs text-faint">{when(c.updated_at)}</span>
                      {typeof c.unread === 'number' && c.unread > 0 ? (
                        <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-extrabold text-[#0b1220]">
                          {c.unread}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{c.previewText || '—'}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-faint">
                    {providerMeta(c.provider).label}
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
