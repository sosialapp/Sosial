'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ChannelAvatar from '@/components/ChannelAvatar';
import { POST_STATUS_META, providerMeta } from '@/lib/providers';
import type { PostStatus } from '@/lib/types';

export interface PeekTarget {
  provider: string;
  channel_id: string;
}

export interface PeekPost {
  id: string;
  title: string;
  body: string;
  scheduled_at: string | null;
  status: PostStatus;
  targets: PeekTarget[];
}

/**
 * Dashboard mini-calendar block: opens a detail popup instead of navigating
 * away. Read-only — retiming and deletes live on /calendar.
 */
export default function PostPeek({
  post,
  when,
  avatars,
  threadParts,
}: {
  post: PeekPost;
  /** Preformatted "Saturday, 4:46 PM". */
  when: string;
  avatars: Record<string, string>;
  threadParts: number;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open ]);

  const st = POST_STATUS_META[post.status];
  const text = (post.title || post.body || 'Untitled post').replace(/\s+/g, ' ').trim();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-1 block w-full rounded-md bg-paper-dim px-2 py-1 text-left transition hover:opacity-85"
      >
        <span className="flex items-center gap-1.5">
          {post.targets.slice(0, 3).map((t) => (
            <ChannelAvatar
              key={t.channel_id}
              provider={t.provider}
              avatar={avatars[t.channel_id]}
              size={16}
            />
          ))}
          <span className="truncate text-[10px] font-extrabold tabular-nums text-ink">{when}</span>
        </span>
        <span className="mt-0.5 block truncate text-[10px] font-medium text-soft">{text}</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Post details">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="relative flex min-h-full items-center justify-center p-4">
            <div className="relative my-auto w-full max-w-sm rounded-3xl border border-line bg-card p-6 shadow-[0_32px_80px_-24px_rgba(28,25,23,0.5)]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-bone hover:text-ink"
              >
                ✕
              </button>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${st.className}`}>
                  {st.label}
                </span>
                <span className="text-xs text-muted">{when}</span>
              </div>
              {threadParts > 1 ? (
                <p className="mt-2 text-xs font-bold text-faint">Thread · {threadParts} parts</p>
              ) : null}
              <p className="mt-3 font-display text-base font-extrabold tracking-tight">
                {post.title || 'Untitled post'}
              </p>
              {post.body ? (
                <p className="mt-2 max-h-48 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap break-words text-soft">
                  {post.body}
                </p>
              ) : null}
              {post.targets.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {post.targets.map((t) => (
                    <div key={t.channel_id} className="flex items-center gap-2">
                      <ChannelAvatar provider={t.provider} avatar={avatars[t.channel_id]} size={24} />
                      <span className="text-xs font-bold">{providerMeta(t.provider).label}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <Link
                href="/calendar"
                className="mt-5 inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-xs font-bold text-soft transition hover:border-ink hover:text-ink"
              >
                Open in calendar
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
