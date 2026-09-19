'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PostWithTargets, PostStatus } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { deletePost, publishPostNow } from '@/lib/posts';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import { formatDateTime } from '@/lib/format';

type Tab = 'all' | 'queue' | 'drafts' | 'sent' | 'failed';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'queue', label: 'Queue' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'sent', label: 'Sent' },
  { id: 'failed', label: 'Failed' },
];

const TAB_MATCH: Record<Tab, (s: PostStatus) => boolean> = {
  all: () => true,
  queue: (s) => s === 'queued' || s === 'publishing',
  drafts: (s) => s === 'draft' || s === 'approval',
  sent: (s) => s === 'sent' || s === 'partial',
  failed: (s) => s === 'failed',
};

function snippet(p: PostWithTargets): string {
  const text = (p.title || p.body || 'Untitled').replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export default function PostList({ posts }: { posts: PostWithTargets[] }) {
  const router = useRouter();
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

  async function act(id: string, fn: (sb: SupabaseClient, postId: string) => Promise<void>) {
    setBusyId(id);
    setErr(null);
    try {
      await fn(createClient(), id);
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line px-6 py-4">
        <p className="eyebrow">Queue</p>
        <h1 className="font-display text-xl font-extrabold tracking-tight">Posts</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                tab === t.id ? 'bg-accent text-white' : 'bg-surface text-soft hover:bg-line'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {err && <p className="border-b border-line bg-[#FDEBEC] px-6 py-2 text-sm text-[#9F2F2D]">{err}</p>}

      <div className="flex-1 space-y-2 p-6">
        {rows.length === 0 && <p className="text-sm text-muted">Nothing here yet.</p>}
        {rows.map((p) => {
          const meta = POST_STATUS_META[p.status];
          const providers = Array.from(new Set(p.post_targets.map((t) => t.provider)));
          const media = p.post_media?.length ?? 0;
          const canPublish = p.status === 'draft' || p.status === 'failed';
          return (
            <div key={p.id} className="card flex flex-wrap items-start gap-4 p-4">
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
                  {media > 0 && <span className="text-xs text-faint">{media} media</span>}
                  <span className="text-xs text-faint">
                    {p.sent_at ? `Sent ${formatDateTime(p.sent_at)}` : formatDateTime(p.scheduled_at)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink">{snippet(p)}</p>
                {p.post_targets.some((t) => t.last_error) && (
                  <p className="mt-1 text-xs text-[#9F2F2D]">
                    {p.post_targets.find((t) => t.last_error)?.last_error}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canPublish && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => act(p.id, publishPostNow)}
                  >
                    Publish now
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => act(p.id, deletePost)}
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
