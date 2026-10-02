import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { channelManageError } from '@/lib/channelAccess';
import { PICK_COOKIE, b64d, type PickState } from '@/lib/oauthServer';

/**
 * POST /api/oauth/reddit-finish { subreddit }
 * Second half of the Reddit connect: the user picked a destination
 * subreddit from the list the callback stashed, so import one row per
 * subreddit (external_id u/{user}/r/{sr}) with the stashed tokens.
 */
export async function POST(req: Request) {
  let subreddit = '';
  try {
    subreddit = String((await req.json())?.subreddit ?? '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  if (!subreddit || !/^[A-Za-z0-9_]+$/.test(subreddit)) {
    return NextResponse.json({ error: 'Pick a subreddit first.' }, { status: 400 });
  }

  const jar = await cookies();
  const pick = b64d<PickState>(jar.get(PICK_COOKIE)?.value);
  const rd = pick?.reddit;
  if (!pick || !rd?.access_token || !rd.username) {
    return NextResponse.json({ error: 'That login expired — connect Reddit again.' }, { status: 400 });
  }
  const known = (rd.subreddits ?? []).some(
    (s) => s.name.toLowerCase() === subreddit,
  );

  const sb = await createClient();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const denied = await channelManageError(sb, pick.workspace_id);
  if (denied) {
    const res = NextResponse.json({ error: denied }, { status: 403 });
    res.cookies.delete(PICK_COOKIE);
    return res;
  }

  const externalId = `u/${rd.username.toLowerCase()}/r/${subreddit}`;
  const { data: existing } = await sb
    .from('connected_channels')
    .select('id,status')
    .eq('workspace_id', pick.workspace_id)
    .eq('provider', 'reddit')
    .eq('external_id', externalId)
    .maybeSingle();
  if (existing && (existing as { status?: string }).status === 'connected') {
    return NextResponse.json({ already: true });
  }

  const { error: impErr } = await sb.functions.invoke('import-channel-token', {
    body: {
      workspace_id: pick.workspace_id,
      provider: 'reddit',
      external_id: externalId,
      display_name: `r/${subreddit}`,
      handle: `@${rd.username}`,
      metadata: {
        redditUser: rd.username,
        subreddit,
        // Free-form entry (typed, not subscribed): still posts, but Reddit
        // may hold it for mod review — the picker list is the safe path.
        unlisted: !known,
        ...(rd.avatar ? { avatar: rd.avatar } : {}),
      },
      access_token: rd.access_token,
      refresh_token: rd.refresh_token,
      expires_at: rd.expires_at,
    },
  });
  // Keep the stash for adding more subreddits; drop only the picked row? No —
  // tokens are account-level, the stash stays valid for the whole session.
  // (Cookie is httpOnly 10-min; reconnect re-stashes.)
  if (impErr) return NextResponse.json({ error: impErr.message }, { status: 502 });
  return NextResponse.json({ ok: true });
}
