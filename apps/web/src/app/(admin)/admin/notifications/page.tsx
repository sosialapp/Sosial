import PushComposer from '@/components/PushComposer';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  update: 'Product update',
  policy: 'Policy / terms',
  bug: 'Bug notice',
  announcement: 'Announcement',
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

/** Owner broadcast: compose once, the bell + worker fan it out. */
export default async function AdminNotificationsPage() {
  const sb = await createClient();
  const [ios, android, recent] = await Promise.all([
    sb.from('push_tokens').select('id', { count: 'exact', head: true }).eq('platform', 'ios'),
    sb.from('push_tokens').select('id', { count: 'exact', head: true }).eq('platform', 'android'),
    sb
      .from('announcements')
      .select('id,kind,title,platforms,created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const counts = { ios: ios.count ?? 0, android: android.count ?? 0 };
  const total = counts.ios + counts.android;
  const rows = (recent.data ?? []) as {
    id: string;
    kind: string;
    title: string;
    platforms: string[];
    created_at: string;
  }[];

  return (
    <div>
      <p className="eyebrow">Owner console</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
        Notifications
      </h1>
      <p className="mt-1 text-sm text-muted">
        Send to the in-app bell and, on request, to devices ·{' '}
        {total === 0
          ? 'no devices registered yet'
          : `${counts.ios} iOS · ${counts.android} Android`}
      </p>
      <div className="mt-4 max-w-2xl">
        <PushComposer counts={counts} />
      </div>

      <h2 className="mt-8 font-display text-lg font-extrabold">Recent</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing sent yet.</p>
      ) : (
        <div className="mt-2 max-w-2xl divide-y divide-line-soft overflow-hidden rounded-2xl border border-line bg-card">
          {rows.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{r.title}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {KIND_LABEL[r.kind] ?? r.kind} · {(r.platforms ?? []).join(' + ') || 'all'}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-faint">{ago(r.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
