'use client';

/**
 * Notification bell — header island. Polls `notifications` (RLS: own rows)
 * every 30s for unread count, lists the latest in a WorkspaceSwitcher-style
 * dropdown, marks all read on open, clicks navigate via the notification's
 * href. Events are written by P48 DB triggers: team changes, approvals and
 * publish results.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface NotifRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

const KIND_ICON: Record<string, string> = {
  member_joined: '👋',
  member_left: '👋',
  member_removed: '🚪',
  role_changed: '🛡️',
  approval_requested: '📝',
  approval_approved: '✅',
  approval_changes: '✏️',
  target_sent: '🚀',
  target_failed: '⚠️',
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
        .select('id,kind,title,body,href,read_at,created_at')
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
                const inner = (
                  <div className="flex gap-2.5 px-4 py-3">
                    <span aria-hidden="true" className="text-base leading-5">
                      {KIND_ICON[n.kind] ?? '🔔'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-xs ${n.read_at ? 'text-muted' : 'font-bold text-ink'}`}>
                          {n.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-faint">{ago(n.created_at)}</span>
                      </span>
                      {n.body ? (
                        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-muted">
                          {n.body}
                        </span>
                      ) : null}
                    </span>
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
