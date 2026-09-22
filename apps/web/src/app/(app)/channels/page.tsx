import { redirect } from 'next/navigation';
import AvatarSync from '@/components/AvatarSync';
import ChannelAvatar, { channelAvatar } from '@/components/ChannelAvatar';
import ConnectGuide from '@/components/ConnectGuide';
import DisconnectChannel from '@/components/DisconnectChannel';
import { fetchChannels } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';
import { ALL_PROVIDERS, providerMeta } from '@/lib/providers';
import type { ConnectedChannel } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  connected: 'bg-[#EDF3EC] text-[#346538] dark:bg-[#1c2b21] dark:text-[#8fd0a0]',
  expired: 'bg-accent-soft text-accent-ink',
  revoked: 'bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]',
  error: 'bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]',
};

const DOT: Record<string, string> = {
  connected: 'bg-[#2f8f5b]',
  expired: 'bg-[#e6a417]',
  revoked: 'bg-[#E60023]',
  error: 'bg-[#E60023]',
};

function accountLabel(c: ConnectedChannel): string {
  return c.handle ? `@${c.handle}` : (c.display_name ?? c.external_id);
}

/** One card per social network — its accounts stack inside, never split out. */
export default async function ChannelsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const channels = await fetchChannels(sb, ctx.workspace.id);

  const byProvider = new Map<string, ConnectedChannel[]>();
  for (const c of channels) {
    const list = byProvider.get(c.provider) ?? [];
    list.push(c);
    byProvider.set(c.provider, list);
  }
  const providers = ALL_PROVIDERS.filter((p) => byProvider.has(p));
  const missingAvatars = channels.filter(
    (c) => c.status === 'connected' && !channelAvatar(c.metadata),
  ).length;

  return (
    <div className="flex min-h-screen flex-col">
      <AvatarSync workspaceId={ctx.workspace.id} missing={missingAvatars} />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <p className="eyebrow">Channels</p>
          <h1 className="font-display text-xl font-extrabold tracking-tight">Connected accounts</h1>
        </div>
        <ConnectGuide />
      </header>

      <div className="grid flex-1 content-start gap-2.5 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
        {providers.length === 0 && (
          <p className="text-sm text-muted">
            No channels connected. Connect accounts in the mobile app; they appear here immediately.
          </p>
        )}
        {providers.map((p) => {
          const list = byProvider.get(p)!;
          const meta = providerMeta(p);
          const live = list.filter((c) => c.status === 'connected').length;
          const overall = live === list.length ? 'connected' : live > 0 ? 'expired' : list[0].status;
          const overallLabel =
            live === list.length ? (list.length > 1 ? `${list.length} live` : 'connected') : `${live}/${list.length} live`;
          return (
            <div key={p} className="rounded-2xl border border-line bg-card p-3.5">
              <div className="flex items-center gap-2.5">
                <ChannelAvatar
                  provider={p}
                  avatar={channelAvatar(list.find((c) => c.status === 'connected')?.metadata ?? list[0].metadata)}
                  size={32}
                />
                <p className="min-w-0 flex-1 truncate text-sm font-bold">{meta.label}</p>
                <span className={`pill shrink-0 ${STATUS_STYLE[overall] ?? 'bg-surface text-soft'}`}>
                  {overallLabel}
                </span>
              </div>
              <ul className="mt-2.5 space-y-1.5 border-t border-line-soft pt-2.5">
                {list.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <ChannelAvatar provider={p} avatar={channelAvatar(c.metadata)} size={22} />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{accountLabel(c)}</span>
                    {(ctx.workspace.role === 'owner' || ctx.workspace.role === 'admin') && (
                      <DisconnectChannel
                        workspaceId={ctx.workspace.id}
                        provider={c.provider}
                        externalId={c.external_id}
                      />
                    )}
                    <span
                      aria-hidden="true"
                      title={c.status}
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[c.status] ?? 'bg-surface'}`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="px-6 pb-6 text-xs text-faint">
        Owners and admins can disconnect an account here. Reconnecting stays in the mobile app
        until web OAuth ships.
      </p>
    </div>
  );
}
