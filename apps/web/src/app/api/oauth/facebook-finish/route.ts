import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { PICK_COOKIE, b64d, type PickState } from '@/lib/oauthServer';

/**
 * POST /api/oauth/facebook-finish { page_id }
 * Second half of the Facebook connect: the user picked a Page from the list
 * the callback stashed, so import that Page's token as the channel.
 */
export async function POST(req: Request) {
  let pageId = '';
  try {
    pageId = String((await req.json())?.page_id ?? '');
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  if (!pageId) return NextResponse.json({ error: 'Pick a Page first.' }, { status: 400 });

  const jar = await cookies();
  const pick = b64d<PickState>(jar.get(PICK_COOKIE)?.value);
  const page = pick?.pages.find((p) => p.id === pageId);
  if (!pick || !page) {
    return NextResponse.json({ error: 'That login expired — connect Facebook again.' }, { status: 400 });
  }

  const sb = await createClient();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  // Same Page twice is a no-op with a name — but let expired rows heal.
  const { data: existing } = await sb
    .from('connected_channels')
    .select('id,status')
    .eq('workspace_id', pick.workspace_id)
    .eq('provider', 'facebook')
    .eq('external_id', page.id)
    .maybeSingle();
  if (existing && (existing as { status?: string }).status === 'connected') {
    const res = NextResponse.json({ already: true });
    res.cookies.delete(PICK_COOKIE);
    return res;
  }

  const { error: impErr } = await sb.functions.invoke('import-channel-token', {
    body: {
      workspace_id: pick.workspace_id,
      provider: 'facebook',
      external_id: page.id,
      display_name: page.name,
      metadata: page.picture ? { avatar: page.picture } : {},
      access_token: page.access_token,
    },
  });
  const res = impErr
    ? NextResponse.json({ error: impErr.message }, { status: 502 })
    : NextResponse.json({ ok: true });
  res.cookies.delete(PICK_COOKIE);
  return res;
}
