import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import AvatarSync from '@/components/AvatarSync';
import { channelAvatar } from '@/lib/channelAvatar';
import ConnectPanel, { type FbPickPage, type GmbPickLocation } from '@/components/ConnectPanel';
import { fetchChannels } from '@/lib/posts';
import { getEntitlement } from '@/lib/billing/entitlement';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

export const metadata = { title: 'Channels' };


export const dynamic = 'force-dynamic';

/** Mobile-style Connect list: one row per provider, expanding into accounts. */
export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; already?: string; error?: string; connect?: string }>;
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/login');
  const sb = await createClient();
  const channels = await fetchChannels(sb, ctx.workspace.id);
  const entitlement = await getEntitlement(ctx.workspace.id);
  const params = await searchParams;

  // Facebook Page pick pending from the OAuth callback (httpOnly cookie).
  let fbPick: FbPickPage[] | null = null;
  let fbOmitted = 0;
  if (params.connect === 'facebook') {
    try {
      const jar = await cookies();
      const raw = jar.get('sosial_fb_pick')?.value;
      const pick = raw
        ? (JSON.parse(Buffer.from(raw, 'base64url').toString()) as {
            workspace_id?: string;
            pages?: FbPickPage[];
            omitted?: number;
          })
        : null;
      if (pick?.workspace_id === ctx.workspace.id && Array.isArray(pick.pages)) {
        fbPick = pick.pages;
        fbOmitted = typeof pick.omitted === 'number' ? pick.omitted : 0;
      }
    } catch {
      fbPick = null;
    }
  }

  // GBP location pick pending from the OAuth callback (httpOnly cookie).
  let gmbPick: GmbPickLocation[] | null = null;
  if (params.connect === 'gmb') {
    try {
      const jar = await cookies();
      const raw = jar.get('sosial_fb_pick')?.value;
      const pick = raw
        ? (JSON.parse(Buffer.from(raw, 'base64url').toString()) as {
            workspace_id?: string;
            gmb?: { locations?: GmbPickLocation[] };
          })
        : null;
      if (pick?.workspace_id === ctx.workspace.id && Array.isArray(pick.gmb?.locations)) {
        gmbPick = pick.gmb!.locations;
      }
    } catch {
      gmbPick = null;
    }
  }

  // Disconnected accounts are revoked, not deleted: the row stays so old posts
  // keep their destination, but it is no longer a connected account to show.
  // (Delete data is the separate opt-in path that removes the row for good.)
  const visibleChannels = channels.filter((c) => c.status !== 'revoked');

  const missingAvatars = visibleChannels.filter(
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
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6 sm:pt-6">
        <ConnectPanel
          workspaceId={ctx.workspace.id}
          channels={visibleChannels}
          fbPick={fbPick}
          fbOmitted={fbOmitted}
          gmbPick={gmbPick}
          status={{ connected: params.connected, already: params.already, error: params.error }}
          canManage={ctx.workspace.role === 'owner' || ctx.workspace.role === 'admin'}
          plan={entitlement.plan}
        />
      </div>

      <p className="mx-auto w-full max-w-2xl px-6 py-6 text-xs text-faint">
        Owners and admins can disconnect an account here: disconnecting deletes its tokens from the
        vault and pauses anything scheduled for it, while Delete data also erases the history Sosial
        kept for it. Members see the accounts they are assigned on the Team page.
      </p>
    </div>
  );
}
