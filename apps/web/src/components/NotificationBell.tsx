'use client';

/**
 * Notification bell, header island. Polls `notifications` (RLS: own rows) and
 * app-wide `announcements` (P75, filtered to the 'web' platform) every 120s,
 * merges them newest-first, and lists the latest in a WorkspaceSwitcher-style
 * dropdown; opening marks everything read. Event rows come from P48/P60 DB
 * triggers (team changes, approvals, publish results) and link via `href`;
 * announcements carry their own per-user read state in `announcement_reads`.
 *
 * Publish rows carry post_id and render rich: channel label list in the
 * title ("Published to X @acme, Instagram @acme"), an avatar/logo row, the
 * post's first media thumb when it has media, then "<text> is live.".
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  Bug,
  CheckCheck,
  FileText,
  Megaphone,
  PenLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unplug,
  UserPlus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ChannelAvatar from '@/components/ChannelAvatar';
import SafeImg from '@/components/SafeImg';
import { channelAvatar } from '@/lib/channelAvatar';

export interface NotifRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  post_id?: string | null;
  read_at: string | null;
  created_at: string;
}

/** One merged feed row: a per-recipient `notifications` row or an app-wide
 *  `announcements` row. `read` folds the two read-state mechanisms together
 *  (read_at column vs. an announcement_reads row). */
export interface FeedRow {
  id: string;
  source: 'notification' | 'announcement';
  kind: string;
  title: string;
  body: string;
  href: string | null;
  post_id?: string | null;
  read: boolean;
  created_at: string;
}

interface ChannelInfo {
  provider: string;
  handle: string | null;
  avatar?: string;
}

interface PostExtras {
  channels: ChannelInfo[];
  mediaUrl?: string;
}

const KIND_ICON: Record<string, typeof Bell> = {
  member_joined: UserPlus,
  member_left: UserPlus,
  member_removed: UserPlus,
  role_changed: ShieldCheck,
  approval_requested: FileText,
  approval_approved: CheckCheck,
  approval_changes: PenLine,
  target_failed: AlertTriangle,
  channel_expired: Unplug,
  update: Sparkles,
  policy: ShieldCheck,
  bug: Bug,
  announcement: Megaphone,
};

function ago(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function NotificationBell() {
  const [items, setItems] = useState<FeedRow[]>([]);
  const [extras, setExtras] = useState<Record<string, PostExtras>>({});
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sb = useRef<ReturnType<typeof createClient> | null>(null);

  const load = useCallback(async () => {
    try {
      if (!sb.current) sb.current = createClient();
      const client = sb.current;
      const [notifs, anns, reads] = await Promise.all([
        client
          .from('notifications')
          .select('id,kind,title,body,href,post_id,read_at,created_at')
          .order('created_at', { ascending: false })
          .limit(20),
        client
          .from('announcements')
          .select('id,kind,title,body,href,created_at')
          .overlaps('platforms', ['web'])
          .order('created_at', { ascending: false })
          .limit(20),
        client.from('announcement_reads').select('announcement_id, dismissed_at'),
      ]);

      const readRows = (reads.data ?? []) as { announcement_id: string; dismissed_at: string | null }[];
      const readIds = new Set(readRows.map((r) => r.announcement_id));
      const dismissed = new Set(readRows.filter((r) => r.dismissed_at).map((r) => r.announcement_id));
      const merged: FeedRow[] = [
        ...((notifs.data ?? []) as NotifRow[]).map((n) => ({
          ...n,
          source: 'notification' as const,
          read: !!n.read_at,
        })),
        ...((anns.data ?? []) as Omit<NotifRow, 'read_at' | 'post_id'>[])
          .filter((a) => !dismissed.has(a.id))
          .map((a) => ({
            ...a,
            source: 'announcement' as const,
            post_id: null,
            read: readIds.has(a.id),
          })),
      ]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 20);

      setItems(merged);
      setUnread(merged.filter((r) => !r.read).length);
    } catch {
      // offline, keep the last list; the next tick retries.
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 120000);
    return () => clearInterval(t);
  }, [load]);

  // Enrich publish rows: sent channels + first media thumb per post.
  const postsKey = [...new Set(items.filter((n) => n.post_id).map((n) => n.post_id as string))].slice(0, 12).join(',');
  useEffect(() => {
    if (!postsKey || !sb.current) return;
    const postIds = postsKey.split(',');
    let alive = true;
    void (async () => {
      const client = sb.current!;
      const [targets, pm] = await Promise.all([
        client
          .from('post_targets')
          .select('post_id, provider, status, connected_channels(handle, display_name, metadata)')
          .in('post_id', postIds),
        client
          .from('post_media')
          .select('post_id, position, media_assets(kind, storage_path, thumb_path, storage_backend)')
          .in('post_id', postIds)
          .order('position'),
      ]);
      if (!alive) return;

      const out: Record<string, PostExtras> = {};
      for (const id of postIds) {
        const chans = ((targets.data ?? []) as Record<string, unknown>[])
          .filter((t) => t.post_id === id && t.status === 'sent')
          .map((t) => {
            const cc = t.connected_channels as { handle?: string | null; display_name?: string | null; metadata?: Record<string, unknown> } | null;
            return {
              provider: String(t.provider),
              handle: cc?.handle ?? null,
              avatar: channelAvatar(cc?.metadata ?? {}),
            };
          });
        out[id] = { channels: chans };
      }

      // Sign everything in one pass: R2 via the edge, legacy via Storage.
      const firstPerPost = new Map<string, { path: string; backend: string }>();
      for (const r of (pm.data ?? []) as Record<string, unknown>[]) {
        const asset = r.media_assets as { kind: string; storage_path: string; thumb_path: string | null; storage_backend: string } | null;
        if (!asset || firstPerPost.has(String(r.post_id))) continue;
        const path = asset.thumb_path ?? (asset.kind === 'image' ? asset.storage_path : null);
        if (path) firstPerPost.set(String(r.post_id), { path, backend: asset.storage_backend });
      }
      const toSign = [...firstPerPost.values()];
      const signed = new Map<string, string>();
      const r2 = toSign.filter((s) => s.backend === 'r2');
      const legacy = toSign.filter((s) => s.backend !== 'r2');
      if (r2.length) {
        try {
          const { data: res } = await client.functions.invoke('media', {
            body: { action: 'sign', items: r2.map((s) => ({ path: s.path, bucket: 'post-media' })), expiresIn: 3600 },
          });
          const urls = (res as { urls?: string[] } | null)?.urls ?? [];
          r2.forEach((s, i) => {
            if (urls[i]) signed.set(s.path, urls[i]);
          });
        } catch {}
      }
      if (legacy.length) {
        try {
          const { data: urls } = await client.storage
            .from('post-media')
            .createSignedUrls(legacy.map((s) => s.path), 3600);
          legacy.forEach((s, i) => {
            const u = (urls as { path: string; signedUrl: string | null }[] | null)?.[i]?.signedUrl;
            if (u) signed.set(s.path, u);
          });
        } catch {}
      }
      // Attach resolved thumbs.
      for (const [id, spec] of firstPerPost) {
        const url = signed.get(spec.path);
        if (url) out[id] = { ...out[id], mediaUrl: url };
      }
      if (alive) setExtras(out);
    })();
    return () => {
      alive = false;
    };
  }, [postsKey]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) {
      setConfirmAll(false);
      return;
    }
    if (unread === 0) return;
    // Optimistic: clear the badge and the unread styling immediately.
    setUnread(0);
    setItems((prev) => prev.map((r) => ({ ...r, read: true })));
    const client = sb.current;
    if (!client) return;
    try {
      await client
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);
      const unreadAnn = items
        .filter((n) => n.source === 'announcement' && !n.read)
        .map((n) => n.id);
      if (unreadAnn.length) {
        const {
          data: { user },
        } = await client.auth.getUser();
        if (user) {
          await client.from('announcement_reads').upsert(
            unreadAnn.map((id) => ({ announcement_id: id, user_id: user.id })),
            { onConflict: 'announcement_id,user_id' },
          );
        }
      }
    } catch {}
  }

  /** Delete one bell row. A notification belongs to this user (hard delete);
   *  an announcement is app-wide, so dismissing it is recorded per user. */
  async function remove(n: FeedRow) {
    if (deleting) return;
    setDeleting(`${n.source}-${n.id}`);
    setItems((prev) => prev.filter((x) => !(x.source === n.source && x.id === n.id)));
    setUnread((prev) => Math.max(0, prev - (n.read ? 0 : 1)));
    const client = sb.current ?? (sb.current = createClient());
    try {
      if (n.source === 'notification') {
        await client.from('notifications').delete().eq('id', n.id);
      } else {
        const {
          data: { user },
        } = await client.auth.getUser();
        if (user) {
          await client.from('announcement_reads').upsert(
            { announcement_id: n.id, user_id: user.id, dismissed_at: new Date().toISOString() },
            { onConflict: 'announcement_id,user_id' },
          );
        }
      }
    } catch {
      void load();
    } finally {
      setDeleting(null);
    }
  }

  /**
   * Clear the whole bell. Two taps, because it is irreversible: the first
   * arms the button for four seconds, the second deletes. Notifications are
   * this user's own rows (hard delete); announcements are app-wide, so the
   * visible ones are dismissed per user, same as the single-row path.
   */
  async function removeAll() {
    if (deleting || items.length === 0) return;
    if (!confirmAll) {
      setConfirmAll(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmAll(false), 4000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmAll(false);

    const snapshot = items;
    setDeleting('all');
    setItems([]);
    setUnread(0);

    const client = sb.current ?? (sb.current = createClient());
    try {
      await client.from('notifications').delete().not('id', 'is', null);
      const annIds = snapshot.filter((n) => n.source === 'announcement').map((n) => n.id);
      if (annIds.length) {
        const {
          data: { user },
        } = await client.auth.getUser();
        if (user) {
          await client.from('announcement_reads').upsert(
            annIds.map((id) => ({
              announcement_id: id,
              user_id: user.id,
              dismissed_at: new Date().toISOString(),
            })),
            { onConflict: 'announcement_id,user_id' },
          );
        }
      }
    } catch {
      void load();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-soft transition hover:bg-bone"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-card shadow-[0_16px_50px_rgba(28,26,20,0.25)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
            <p className="text-sm font-extrabold">Notifications</p>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                All read
              </span>
              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void removeAll()}
                  disabled={deleting === 'all'}
                  aria-label={confirmAll ? 'Confirm delete all notifications' : 'Delete all notifications'}
                  title="Delete all"
                  className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition disabled:opacity-60 ${
                    confirmAll
                      ? 'bg-[#9F2F2D] text-white'
                      : 'text-muted hover:bg-surface hover:text-[#9F2F2D]'
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {deleting === 'all' ? 'Deleting' : confirmAll ? 'Delete all?' : 'Delete all'}
                </button>
              ) : null}
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted">
                Nothing yet, announcements, publish results, approvals and team changes land here.
              </p>
            ) : (
              items.map((n) => {
                const isPublish = n.kind === 'target_sent' && n.post_id;
                const ex = isPublish ? extras[n.post_id as string] : undefined;
                const Icon = KIND_ICON[n.kind];
                const inner = (
                  <div className="flex gap-2.5 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-xs ${n.read ? 'text-muted' : 'font-bold text-ink'}`}>
                          {n.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-faint">{ago(n.created_at)}</span>
                      </span>
                      {ex && ex.channels.length > 0 ? (
                        <span className="mt-1.5 flex flex-wrap items-center gap-1">
                          {ex.channels.slice(0, 6).map((c, i) => (
                            <ChannelAvatar
                              key={`${c.provider}-${i}`}
                              provider={c.provider}
                              avatar={c.avatar}
                              size={18}
                            />
                          ))}
                        </span>
                      ) : null}
                      {ex?.mediaUrl ? (
                        <SafeImg
                          src={ex.mediaUrl}
                          alt=""
                          className="mt-1.5 h-20 w-20 rounded-lg border border-line object-cover"
                        />
                      ) : null}
                      {n.body ? (
                        <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-muted">
                          {n.body}
                        </span>
                      ) : null}
                    </span>
                    {Icon ? (
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
                    ) : null}
                    {!n.read ? <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> : null}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void remove(n);
                      }}
                      disabled={deleting === `${n.source}-${n.id}`}
                      aria-label={`Delete ${n.title}`}
                      title="Delete"
                      className="mt-0.5 shrink-0 rounded-md p-1 text-faint transition hover:bg-surface hover:text-[#9F2F2D] disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
                return n.href ? (
                  <Link
                    key={`${n.source}-${n.id}`}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-line-soft transition last:border-0 hover:bg-bone"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={`${n.source}-${n.id}`} className="border-b border-line-soft last:border-0">
                    {inner}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
