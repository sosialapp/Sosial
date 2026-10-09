'use client';

/**
 * Notification bell — header island. Polls `notifications` (RLS: own rows)
 * every 30s for unread count, lists the latest in a WorkspaceSwitcher-style
 * dropdown, marks all read on open, clicks navigate via the notification's
 * href. Events are written by P48/P60 DB triggers: team changes, approvals
 * and publish results.
 *
 * Publish rows carry post_id and render rich: channel label list in the
 * title ("Published to X @acme, Instagram @acme"), an avatar/logo row, the
 * post's first media thumb when it has media, then "<text> is live.".
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, CheckCheck, FileText, PenLine, ShieldCheck, Unplug, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ChannelAvatar from '@/components/ChannelAvatar';
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
  const [items, setItems] = useState<NotifRow[]>([]);
  const [extras, setExtras] = useState<Record<string, PostExtras>>({});
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const sb = useRef<ReturnType<typeof createClient> | null>(null);

  const load = useCallback(async () => {
    try {
      if (!sb.current) sb.current = createClient();
      const client = sb.current;
      const { data } = await client
        .from('notifications')
        .select('id,kind,title,body,href,post_id,read_at,created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      const rows = (data ?? []) as NotifRow[];
      setItems(rows);
      setUnread(rows.filter((r) => !r.read_at).length);
    } catch {
      // offline — keep the last list; the next tick retries.
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30000);
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

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      // Optimistic: clear the badge immediately, persist in the background.
      setUnread(0);
      try {
        await sb.current
          ?.from('notifications')
          .update({ read_at: new Date().toISOString() })
          .is('read_at', null);
      } catch {}
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
          <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
            <p className="text-sm font-extrabold">Notifications</p>
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              All read
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted">
                Nothing yet — publish results, approvals and team changes land here.
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
                        <span className={`truncate text-xs ${n.read_at ? 'text-muted' : 'font-bold text-ink'}`}>
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
                        <img
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
                    {!n.read_at ? <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> : null}
                  </div>
                );
                return n.href ? (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-line-soft transition last:border-0 hover:bg-bone"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} className="border-b border-line-soft last:border-0">
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
