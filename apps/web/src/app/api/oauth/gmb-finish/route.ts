import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { channelManageError } from '@/lib/channelAccess';
import { PICK_COOKIE, b64d, type PickState } from '@/lib/oauthServer';

/**
 * POST /api/oauth/gmb-finish { location }
 * Second half of the Google Business Profile connect: the user picked a
 * location from the list the callback stashed, so import it as its own
 * channel (external_id = accounts/{a}/locations/{l}).
 */
export async function POST(req: Request) {
  let location = '';
  try {
    location = String((await req.json())?.location ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  if (!/^accounts\/[^/]+\/locations\/[^/]+$/.test(location)) {
    return NextResponse.json({ error: 'Pick a location first.' }, { status: 400 });
  }

  const jar = await cookies();
  const pick = b64d<PickState>(jar.get(PICK_COOKIE)?.value);
  const gg = pick?.gmb;
  if (!pick || !gg?.access_token) {
    return NextResponse.json({ error: 'That login expired — connect Google Business Profile again.' }, { status: 400 });
  }
  const known = gg.locations.some((l) => l.name === location);
  if (!known) {
    return NextResponse.json({ error: 'That location is not on the connected account.' }, { status: 400 });
  }
  const title = gg.locations.find((l) => l.name === location)?.title ?? location;

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

  const { data: existing } = await sb
    .from('connected_channels')
    .select('id,status')
    .eq('workspace_id', pick.workspace_id)
    .eq('provider', 'gmb')
    .eq('external_id', location)
    .maybeSingle();
  if (existing && (existing as { status?: string }).status === 'connected') {
    return NextResponse.json({ already: true });
  }

  const { error: impErr } = await sb.functions.invoke('import-channel-token', {
    body: {
      workspace_id: pick.workspace_id,
      provider: 'gmb',
      external_id: location,
      display_name: title,
      metadata: {},
      access_token: gg.access_token,
      refresh_token: gg.refresh_token,
      expires_at: gg.expires_at,
    },
  });
  // The stash survives so several locations can be added in one session.
  if (impErr) return NextResponse.json({ error: impErr.message }, { status: 502 });
  return NextResponse.json({ ok: true });
}
