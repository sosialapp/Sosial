'use client';

import { useMemo, useState, useTransition } from 'react';
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

type Tab = 'all' | 'queue' | 'drafts' | 'approvals' | 'sent' | 'failed';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'queue', label: 'Queue' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'sent', label: 'Sent' },
  { id: 'failed', label: 'Failed' },
];

const TAB_MATCH: Record<Tab, (s: PostStatus) => boolean> = {
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

export default function PostList({
  posts,
  role,
  userId,
  workspaceId,
}: {
  posts: PostWithTargets[];
  role: WorkspaceInfo['role'];
  userId: string;
  workspaceId: string;
}) {
  const router = useRouter();
  const canApprove = role === 'owner' || role === 'admin';
  const [tab, setTab] = useState<Tab>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const rows = useMemo(
    () =>
      posts
        .filter((p) => TAB_MATCH[tab](p.status))
        .sort((a, b) => {
          const at = a.scheduled_at ?? a.created_at;
          const bt = b.scheduled_at ?? b.created_at;
          return bt.localeCompare(at);
        }),
    [posts, tab],
  );

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

  function askChanges(p: PostWithTargets) {
    const comment = window.prompt('What needs changing? (optional)');
    if (comment === null) return;
    void run(p.id, (sb) => requestChanges(sb, { postId: p.id, userId, comment: comment || undefined }));
  }

  return (
    <div className="flex min-h-screen flex-col">
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
                  tab === t.id ? 'bg-zest text-ink' : 'bg-surface text-soft hover:bg-line'
                }`}
              >
                {t.label}
                {count > 0 && <span className="ml-1.5 opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>
      </header>

      {err && (
        <p className="border-b border-line bg-[#FDEBEC] px-6 py-2 text-sm text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]">
          {err}
        </p>
      )}

      <div className="flex-1 space-y-2 p-6">
        {rows.length === 0 && <p className="text-sm text-muted">Nothing here yet.</p>}
        {rows.map((p) => {
          const meta = POST_STATUS_META[p.status];
          const providers = Array.from(new Set(p.post_targets.map((t) => t.provider)));
          const media = mediaOf(p);
          const comment = lastComment(p);
          const draftish = p.status === 'draft' || p.status === 'failed';
          const busy = busyId === p.id;
          return (
              <div
                key={p.id}
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
                  {media.length > 3 && (
                    <span className="self-end text-xs text-faint">+{media.length - 3}</span>
                  )}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`pill ${meta.className}`}>{meta.label}</span>
                  <span className="flex items-center gap-1">
                    {providers.map((pr) => {
                      const pm = providerMeta(pr);
                      return (
                        <span
                          key={pr}
                          title={pm.label}
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: pm.color }}
                        />
                      );
                    })}
                  </span>
                  <span className="text-xs text-faint">
                    {p.sent_at ? `Sent ${formatDateTime(p.sent_at)}` : formatDateTime(p.scheduled_at)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink">{snippet(p)}</p>
                {comment && (
                  <p className="mt-1 text-xs text-accent-ink">Changes requested: “{comment}”</p>
                )}
                {p.post_targets.some((t) => t.last_error) && (
                  <p className="mt-1 text-xs text-[#9F2F2D] dark:text-[#f2a8a8]">
                    {p.post_targets.find((t) => t.last_error)?.last_error}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {canApprove && p.status === 'approval' && (
                  <>
                    <button
                      className="btn bg-zest font-bold text-ink hover:brightness-95"
                      type="button"
                      disabled={busy}
                      onClick={() => run(p.id, (sb) => approvePost(sb, { postId: p.id, userId }))}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={busy}
                      onClick={() => askChanges(p)}
                    >
                      Request changes
                    </button>
                  </>
                )}
                {canApprove && draftish && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={busy}
                    onClick={() => run(p.id, (sb) => publishPostNow(sb, p.id))}
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
                      run(p.id, (sb) => submitForApproval(sb, { postId: p.id, workspaceId, userId }))
                    }
                  >
                    Submit for approval
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={busy}
                  onClick={() => run(p.id, (sb) => deletePost(sb, p.id))}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
