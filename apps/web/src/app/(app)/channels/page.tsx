import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import AvatarSync from '@/components/AvatarSync';
import { channelAvatar } from '@/lib/channelAvatar';
import ConnectPanel, { type FbPickPage, type RedditPickSub, type GmbPickLocation } from '@/components/ConnectPanel';
import { fetchChannels } from '@/lib/posts';
import { createClient, getWorkspaceContext } from '@/lib/supabase/server';

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
  const params = await searchParams;

  // Facebook Page pick pending from the OAuth callback (httpOnly cookie).
  let fbPick: FbPickPage[] | null = null;
  if (params.connect === 'facebook') {
    try {
      const jar = await cookies();
      const raw = jar.get('sosial_fb_pick')?.value;
      const pick = raw ? (JSON.parse(Buffer.from(raw, 'base64url').toString()) as { workspace_id?: string; pages?: FbPickPage[] }) : null;
      if (pick?.workspace_id === ctx.workspace.id && Array.isArray(pick.pages)) fbPick = pick.pages;
    } catch {
      fbPick = null;
    }
  }

  // Reddit subreddit pick pending from the OAuth callback (httpOnly cookie).
  let redditPick: { username: string; subreddits: RedditPickSub[] } | null = null;
  if (params.connect === 'reddit') {
    try {
      const jar = await cookies();
      const raw = jar.get('sosial_fb_pick')?.value;
      const pick = raw
        ? (JSON.parse(Buffer.from(raw, 'base64url').toString()) as {
            workspace_id?: string;
            reddit?: { username?: string; subreddits?: RedditPickSub[] };
          })
        : null;
      if (
        pick?.workspace_id === ctx.workspace.id &&
        typeof pick.reddit?.username === 'string' &&
        Array.isArray(pick.reddit?.subreddits)
      ) {
        redditPick = { username: pick.reddit.username, subreddits: pick.reddit.subreddits };
      }
    } catch {
      redditPick = null;
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
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6 sm:pt-6">
        <ConnectPanel
          workspaceId={ctx.workspace.id}
          channels={channels}
          fbPick={fbPick}
          redditPick={redditPick}
          gmbPick={gmbPick}
          status={{ connected: params.connected, already: params.already, error: params.error }}
          canManage={ctx.workspace.role === 'owner' || ctx.workspace.role === 'admin'}
        />
      </div>

      <p className="mx-auto w-full max-w-2xl px-6 py-6 text-xs text-faint">
        Only the team owner can disconnect an account here — its tokens are deleted from the vault.
        Members see the accounts they are assigned on the Team page.
      </p>
    </div>
  );
}
