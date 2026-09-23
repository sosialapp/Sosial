import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isOAuthProvider, redirectUri } from '@/lib/oauth';
import {
  FLOW_COOKIE,
  PICK_COOKIE,
  b64d,
  b64e,
  cookieOpts,
  type FlowState,
  type PickState,
} from '@/lib/oauthServer';

interface ExchangePayload {
  error?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  external_id?: string;
  display_name?: string;
  handle?: string;
  instance_url?: string;
  metadata?: Record<string, string>;
  pages?: PickState['pages'];
}

/**
 * GET /api/oauth/callback?code=…&state=…
 * Provider landing: verify the flow cookie, exchange the code server-side,
 * import the channel, and bounce back to /channels with the result.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const done = (qs: string) => {
    const res = NextResponse.redirect(`${origin}/channels${qs}`);
    res.cookies.delete(FLOW_COOKIE);
    return res;
  };

  const jar = await cookies();
  const flow = b64d<FlowState>(jar.get(FLOW_COOKIE)?.value);
  const state = url.searchParams.get('state');
  if (!flow || !isOAuthProvider(flow.provider) || !flow.workspace_id || !flow.nonce || flow.nonce !== state) {
    return done(`?error=${encodeURIComponent('That login expired — try connecting again.')}`);
  }
  const providerErr = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  if (providerErr || !code) {
    const desc = url.searchParams.get('error_description');
    return done(`?error=${encodeURIComponent(desc || 'The provider refused the login.')}`);
  }

  const sb = await createClient();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) return done(`?error=${encodeURIComponent('Sign in first.')}`);

  const { data, error: fnErr } = await sb.functions.invoke('oauth-exchange', {
    body: {
      provider: flow.provider,
      code,
      verifier: flow.verifier,
      redirect_uri: redirectUri(origin),
      instance: flow.instance,
      client_id: flow.clientId,
      client_secret: flow.clientSecret,
    },
  });
  const payload = (data ?? {}) as ExchangePayload;
  const fail = payload.error ?? fnErr?.message;
  if (fail) return done(`?error=${encodeURIComponent(fail)}`);

  // Meta tokens are per-Page — stash the list and let the user pick one.
  if (flow.provider === 'facebook') {
    if (!payload.pages?.length) {
      return done(`?error=${encodeURIComponent('No Facebook Pages found on that account.')}`);
    }
    const pick: PickState = { workspace_id: flow.workspace_id, nonce: flow.nonce, pages: payload.pages };
    const res = NextResponse.redirect(`${origin}/channels?connect=facebook`);
    res.cookies.delete(FLOW_COOKIE);
    res.cookies.set(PICK_COOKIE, b64e(pick), cookieOpts(origin));
    return res;
  }

  if (!payload.access_token || !payload.external_id) {
    return done(`?error=${encodeURIComponent('The provider hid the account — try again.')}`);
  }
  // Same account twice is a no-op with a name: skip the import when the live
  // row is already there. Expired/revoked/error rows fall through so a
  // reconnect heals them with fresh tokens.
  const { data: existing } = await sb
    .from('connected_channels')
    .select('id,status')
    .eq('workspace_id', flow.workspace_id)
    .eq('provider', flow.provider)
    .eq('external_id', payload.external_id)
    .maybeSingle();
  if (existing && (existing as { status?: string }).status === 'connected') {
    return done(`?already=${flow.provider}`);
  }
  const { error: impErr } = await sb.functions.invoke('import-channel-token', {
    body: {
      workspace_id: flow.workspace_id,
      provider: flow.provider,
      external_id: payload.external_id,
      display_name: payload.display_name,
      handle: payload.handle,
      instance_url: payload.instance_url,
      metadata: payload.metadata ?? {},
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: payload.expires_at,
    },
  });
  if (impErr) return done(`?error=${encodeURIComponent(impErr.message)}`);
  return done(`?connected=${flow.provider}`);
}
