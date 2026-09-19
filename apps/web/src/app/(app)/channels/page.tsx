import { redirect } from 'next/navigation';
import { fetchChannels } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';
import { providerMeta } from '@/lib/providers';

const STATUS_STYLE: Record<string, string> = {
  connected: 'bg-[#EDF3EC] text-[#346538]',
  expired: 'bg-accent-soft text-accent-ink',
  revoked: 'bg-[#FDEBEC] text-[#9F2F2D]',
  error: 'bg-[#FDEBEC] text-[#9F2F2D]',
};

export default async function ChannelsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const channels = await fetchChannels(sb, ctx.workspace.id);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line px-6 py-4">
        <p className="eyebrow">Channels</p>
        <h1 className="font-display text-xl font-extrabold tracking-tight">Connected accounts</h1>
      </header>

      <div className="grid flex-1 gap-3 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {channels.length === 0 && (
          <p className="text-sm text-muted">
            No channels connected. Connect accounts in the mobile app; they appear here immediately.
          </p>
        )}
        {channels.map((c) => {
          const meta = providerMeta(c.provider);
          const sub = c.handle ? `@${c.handle}` : c.display_name ?? c.external_id;
          return (
            <div key={c.id} className="card flex items-center gap-3 p-4">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                style={{ background: meta.color }}
              >
                {meta.glyph}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{meta.label}</p>
                <p className="truncate text-xs text-muted">{sub}</p>
              </div>
              <span className={`pill ${STATUS_STYLE[c.status] ?? 'bg-surface text-soft'}`}>{c.status}</span>
            </div>
          );
        })}
      </div>

      <p className="px-6 pb-6 text-xs text-faint">
        Expired or revoked accounts need reconnecting from the mobile app — web token import is
        future work.
      </p>
    </div>
  );
}
