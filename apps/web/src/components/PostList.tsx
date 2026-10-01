'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MediaAssetRow, PostWithTargets, PostStatus, WorkspaceInfo } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import {
  approvePost,
  deletePost,
  publishPostNow,
  requestChanges,
  submitForApproval,
} from '@/lib/posts';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import { formatDateTime } from '@/lib/format';
import ChannelAvatar from '@/components/ChannelAvatar';

export type Tab = 'all' | 'queue' | 'drafts' | 'approvals' | 'sent' | 'failed';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'queue', label: 'Queue' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'sent', label: 'Sent' },
  { id: 'failed', label: 'Failed' },
];

export const TAB_MATCH: Record<Tab, (s: PostStatus) => boolean> = {
  all: () => true,
  queue: (s) => s === 'queued' || s === 'publishing',
  drafts: (s) => s === 'draft',
  approvals: (s) => s === 'approval',
  sent: (s) => s === 'sent' || s === 'partial',
  failed: (s) => s === 'failed',
};

function snippet(p: PostWithTargets): string {
  const text = (p.title || p.body || 'Untitled').replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

function mediaOf(p: PostWithTargets): MediaAssetRow[] {
  return [...(p.post_media ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((m) => m.media_assets)
    .filter((m): m is MediaAssetRow => Boolean(m));
}

function lastComment(p: PostWithTargets): string | null {
  const decided = (p.approvals ?? [])
    .filter((a) => a.status === 'changes_requested' && a.comment)
    .sort((a, b) => (b.decided_at ?? b.created_at).localeCompare(a.decided_at ?? a.created_at));
  return decided[0]?.comment ?? null;
}

/** Unique target channels across a card's parts (chain parts share targets). */
function uniqueTargets(parts: PostWithTargets[]): { provider: string; channel_id: string }[] {
  const seen = new Map<string, { provider: string; channel_id: string }>();
  for (const p of parts) {
    for (const t of p.post_targets) {
      const key = t.channel_id ?? t.provider;
      if (!seen.has(key)) seen.set(key, { provider: t.provider, channel_id: t.channel_id });
    }
  }
  return [...seen.values()];
}

/**
 * Full-post preview dialog. Read-only except an Edit shortcut for drafts —
 * actions (approve, publish, delete) stay on the card behind it.
 */
function PreviewDialog({
  parts,
  avatars,
  draftish,
  onClose,
  onEdit,
}: {
  parts: PostWithTargets[];
  avatars: Record<string, string>;
  draftish: boolean;
  onClose: () => void;
  onEdit: (() => void) | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const head = parts[0];
  const meta = POST_STATUS_META[head.status];
  const isChain = parts.length > 1;
  const targets = uniqueTargets(parts);
  const media = parts.flatMap((p) => mediaOf(p));
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Post preview">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden="true" />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div className="relative my-auto w-full max-w-lg rounded-3xl border border-line bg-card p-6 shadow-[0_32px_80px_-24px_rgba(28,25,23,0.5)]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-bone hover:text-ink"
          >
            ✕
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`pill ${meta.className}`}>{meta.label}</span>
            {isChain ? (
              <span className="pill bg-paper-dim text-ink">Chain · {parts.length} parts</span>
            ) : null}
            <span className="text-xs text-faint">
              {head.sent_at ? `Sent ${formatDateTime(head.sent_at)}` : formatDateTime(head.scheduled_at)}
            </span>
          </div>
          {targets.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
              {targets.map((t) => (
                <span key={t.channel_id ?? t.provider} className="flex items-center gap-1.5">
                  <ChannelAvatar provider={t.provider} avatar={avatars[t.channel_id]} size={24} />
                  <span className="text-xs font-bold">{providerMeta(t.provider).label}</span>
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-3 font-display text-base font-extrabold tracking-tight">
            {head.title || 'Untitled post'}
          </p>
          <div className="mt-2 max-h-64 space-y-3 overflow-y-auto">
            {parts.map((p, i) => (
              <div key={p.id}>
                {isChain ? (
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-faint">
                    Part {i + 1} of {parts.length}
                  </p>
                ) : null}
                {p.body ? (
                  <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap break-words text-soft">
                    {p.body}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          {media.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {media.map((m) =>
                m.kind === 'video' ? (
                  <video
                    key={m.id}
                    src={m.signed_url}
                    muted
                    playsInline
                    controls
                    className="h-20 w-20 rounded-lg border border-line bg-bone object-cover"
                  />
                ) : m.signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={m.id}
                    src={m.signed_url}
                    alt=""
                    className="h-20 w-20 rounded-lg border border-line object-cover"
                  />
                ) : null,
              )}
            </div>
          ) : null}
          <div className="mt-5 flex gap-2">
            {draftish && onEdit ? (
              <button type="button" onClick={onEdit} className="btn btn-bolt">
                Edit
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PostList({
  posts,
  role,
  userId,
  workspaceId,
  onEdit,
  avatars = {},
  initialTab,
  hideChrome,
}: {
  posts: PostWithTargets[];
  role: WorkspaceInfo['role'];
  userId: string;
  workspaceId: string;
  /** Optional: open the draft in the composer. Defaults to /post?edit=<id>. */
  onEdit?: (postId: string) => void;
  /** Channel avatar URLs by channel id — brand discs render without photos. */
  avatars?: Record<string, string>;
  /** Preselect a status filter (the /post pills pass theirs). */
  initialTab?: Tab;
  /** Hide the header + pill row (the /post pills already cover filtering). */
  hideChrome?: boolean;
}) {
  const router = useRouter();
  const canApprove = role === 'owner' || role === 'admin';
  const [tab, setTab] = useState<Tab>(initialTab ?? 'all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  /** Chain parts render as ONE card — a thread draft is a single post. */
  const groups = useMemo(() => {
    const filtered = posts
      .filter((p) => TAB_MATCH[tab](p.status))
      .sort((a, b) => {
        const at = a.scheduled_at ?? a.created_at;
        const bt = b.scheduled_at ?? b.created_at;
        return bt.localeCompare(at);
      });
    const out: { key: string; parts: PostWithTargets[] }[] = [];
    const seen = new Set<string>();
    for (const p of filtered) {
      if (p.chain_id) {
        if (seen.has(p.chain_id)) continue;
        seen.add(p.chain_id);
        out.push({
          key: `chain:${p.chain_id}`,
          parts: filtered
            .filter((q) => q.chain_id === p.chain_id)
            .sort((a, b) => a.chain_position - b.chain_position),
        });
      } else {
        out.push({ key: `post:${p.id}`, parts: [p] });
      }
    }
    return out;
  }, [posts, tab]);

  async function run(id: string, fn: (sb: SupabaseClient) => Promise<void>) {
    setBusyId(id);
    setErr(null);
    try {
      await fn(createClient());
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  /** Group actions (a chain's parts share one card): run per part, fail loud. */
  async function runMany(key: string, ids: string[], fn: (sb: SupabaseClient, id: string) => Promise<void>) {
    setBusyId(key);
    setErr(null);
    try {
      const sb = createClient();
      for (const id of ids) {
        await fn(sb, id);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  function askChanges(p: PostWithTargets) {
    const comment = window.prompt('What needs changing? (optional)');
    if (comment === null) return;
    void run(p.id, (sb) => requestChanges(sb, { postId: p.id, userId, comment: comment || undefined }));
  }

  return (
    <div className="flex min-h-screen flex-col">
      {!hideChrome && (
      <header className="border-b border-line px-6 py-4">
        <p className="eyebrow">Queue</p>
        <h1 className="font-display text-xl font-extrabold tracking-tight">Posts</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const count = posts.filter((p) => TAB_MATCH[t.id](p.status)).length;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  tab === t.id ? 'bg-accent text-white' : 'bg-surface text-soft hover:bg-line'
                }`}
              >
                {t.label}
                {count > 0 && <span className="ml-1.5 opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>
      </header>
      )}

      {err && (
        <p className="border-b border-line bg-[#FDEBEC] px-6 py-2 text-sm text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      )}

      <div className="flex-1 space-y-2 p-6">
        {groups.length === 0 && <p className="text-sm text-muted">Nothing here yet.</p>}
        {groups.map((g) => {
          const head = g.parts[0];
          const isChain = g.parts.length > 1;
          const meta = POST_STATUS_META[head.status];
          const media = g.parts.flatMap((p) => mediaOf(p)).slice(0, 3);
          const mediaTotal = g.parts.reduce((n, p) => n + mediaOf(p).length, 0);
          const comment = lastComment(head);
          const draftish = g.parts.every((p) => p.status === 'draft' || p.status === 'failed');
          const inApproval = g.parts.every((p) => p.status === 'approval');
          const busy = busyId === g.key;
          const ids = g.parts.map((p) => p.id);
          const targetErr = g.parts.flatMap((p) => p.post_targets).find((t) => t.last_error)?.last_error;
          const targets = uniqueTargets(g.parts);
          const shownTargets = targets.slice(0, 4);
          const openPreview = () => setPreviewKey(g.key);
          return (
            <>
              <div
                key={g.key}
                className="flex flex-wrap items-start gap-4 rounded-2xl border border-line bg-card p-4"
              >
              {media.length > 0 && (
                <div className="flex shrink-0 gap-1.5">
                  {media.slice(0, 3).map((m) =>
                    m.kind === 'video' ? (
                      <video
                        key={m.id}
                        src={m.signed_url}
                        muted
                        playsInline
                        className="h-16 w-16 rounded-lg border border-line bg-bone object-cover"
                      />
                    ) : m.signed_url ? (
                      <img
                        key={m.id}
                        src={m.signed_url}
                        alt=""
                        className="h-16 w-16 rounded-lg border border-line object-cover"
                      />
                    ) : (
                      <span
                        key={m.id}
                        className="flex h-16 w-16 items-center justify-center rounded-lg border border-line bg-bone text-[10px] text-faint"
                      >
                        {m.kind}
                      </span>
                    ),
                  )}
                  {mediaTotal > 3 && (
                    <span className="self-end text-xs text-faint">+{mediaTotal - 3}</span>
                  )}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`pill ${meta.className}`}>{meta.label}</span>
                  {isChain ? (
                    <span className="pill bg-paper-dim text-ink" title="One threaded chain">
                      Chain · {g.parts.length} parts
                    </span>
                  ) : head.chain_id ? (
                    <span className="pill bg-paper-dim text-ink" title="Part of a threaded chain">
                      Chain · {head.chain_position + 1}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1">
                    {shownTargets.map((t) => (
                      <ChannelAvatar
                        key={t.channel_id ?? t.provider}
                        provider={t.provider}
                        avatar={avatars[t.channel_id]}
                        size={24}
                      />
                    ))}
                    {targets.length > shownTargets.length ? (
                      <span className="text-[11px] font-bold text-faint">+{targets.length - shownTargets.length}</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-faint">
                    {head.sent_at ? `Sent ${formatDateTime(head.sent_at)}` : formatDateTime(head.scheduled_at)}
                  </span>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={openPreview}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openPreview();
                    }
                  }}
                  aria-label={`Preview ${head.title || 'post'}`}
                  title="Preview"
                  className="mt-2 cursor-pointer rounded-lg text-left"
                >
                  <p className="text-sm text-ink">{snippet(head)}</p>
                  {isChain && g.parts[1] ? (
                    <p className="mt-1 text-xs text-muted">+ {g.parts.length - 1} more part{g.parts.length - 1 === 1 ? '' : 's'}: “{snippet(g.parts[1]).slice(0, 60)}…”</p>
                  ) : null}
                </div>
                {comment && (
                  <p className="mt-1 text-xs text-ink">Changes requested: “{comment}”</p>
                )}
                {targetErr && (
                  <p className="mt-1 text-xs text-[#9F2F2D] dark:text-[#f2a8a8]">
                    {targetErr}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={openPreview}
                >
                  Preview
                </button>
                {canApprove && inApproval && (
                  <>
                    <button
                      className="btn btn-bolt"
                      type="button"
                      disabled={busy}
                      onClick={() => runMany(g.key, ids, (sb, id) => approvePost(sb, { postId: id, userId }))}
                    >
                      Approve{isChain ? ` (${ids.length})` : ''}
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={busy}
                      onClick={() => askChanges(head)}
                    >
                      Request changes
                    </button>
                  </>
                )}
                {draftish && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (onEdit) onEdit(head.id);
                      else router.push(`/post?edit=${head.id}`);
                    }}
                  >
                    Edit
                  </button>
                )}
                {canApprove && draftish && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={busy}
                    onClick={() => runMany(g.key, ids, (sb, id) => publishPostNow(sb, id))}
                  >
                    Publish now
                  </button>
                )}
                {!canApprove && draftish && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runMany(g.key, ids, (sb, id) => submitForApproval(sb, { postId: id, workspaceId, userId }))
                    }
                  >
                    Submit for approval
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={busy}
                  onClick={() => runMany(g.key, ids, (sb, id) => deletePost(sb, id))}
                >
                  Delete{isChain ? ` (${ids.length})` : ''}
                </button>
              </div>
            </div>
            {previewKey === g.key ? (
              <PreviewDialog
                parts={g.parts}
                avatars={avatars}
                draftish={draftish}
                onClose={() => setPreviewKey(null)}
                onEdit={
                  draftish
                    ? () => {
                        setPreviewKey(null);
                        if (onEdit) onEdit(head.id);
                        else router.push(`/post?edit=${head.id}`);
                      }
                    : null
                }
              />
            ) : null}
          </>
          );
        })}
      </div>
    </div>
  );
}
