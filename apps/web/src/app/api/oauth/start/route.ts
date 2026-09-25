import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { authorizeUrl, isOAuthProvider, redirectUri, type OAuthConfig } from '@/lib/oauth';
import { FLOW_COOKIE, b64e, cookieOpts, type FlowState } from '@/lib/oauthServer';
import { getEntitlement } from '@/lib/billing/entitlement';
import { PLANS } from '@/lib/billing/plans';

/** X's verifier alphabet (43–128 chars) — plain base64url can contain `_`,
 *  which X rejects, so draw from the allowed set like the mobile app. */
const VERIFIER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

function newVerifier(): string {
  const rand = randomBytes(64);
  let out = '';
  for (const byte of rand) out += VERIFIER_ALPHABET[byte % VERIFIER_ALPHABET.length];
  return out;
}

/**
 * GET /api/oauth/start?provider=tiktok&workspace_id=…
 * Verifies the session + membership, stashes the flow in an httpOnly cookie,
 * and redirects to the provider's consent page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const back = (msg: string) =>
    NextResponse.redirect(`${origin}/channels?error=${encodeURIComponent(msg)}`);

  const provider = url.searchParams.get('provider');
  const workspaceId = url.searchParams.get('workspace_id');
  if (!isOAuthProvider(provider)) return back('Unknown provider.');
  if (!workspaceId) return back('Pick a workspace first.');

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return back('Sign in first.');
  const { data: mem } = await sb
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!mem) return back('Not a member of this workspace.');

  // Free-plan channel cap, enforced server-side (never trust the UI).
  // Reconnecting an already-connected provider is always allowed.
  const entitlement = await getEntitlement(workspaceId);
  const cap = PLANS[entitlement.plan].limits.channels;
  if (!entitlement.active && cap !== null) {
    const { count } = await sb
      .from('connected_channels')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'connected');
    const already = await sb
      .from('connected_channels')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('provider', provider)
      .eq('status', 'connected')
      .limit(1);
    if ((count ?? 0) >= cap && !(already.data ?? []).length) {
      return back(
        `The Free plan connects up to ${cap} channels — you're at the cap. Upgrade in Billing for unlimited channels.`,
      );
    }
  }

  const flow: FlowState = {
    provider,
    workspace_id: workspaceId,
    nonce: randomBytes(16).toString('base64url'),
  };
  let challenge: string | undefined;
  if (provider === 'x') {
    flow.verifier = newVerifier();
    challenge = createHash('sha256').update(flow.verifier).digest('base64url');
  }

  // Public ids come from Supabase (mirrored from the mobile app) — no Vercel
  // env to keep in sync. The route's own session authenticates the call.
  const { data: config } = await sb.functions.invoke('oauth-config', { method: 'GET' });

  let dest: string;
  try {
    dest = authorizeUrl({
      provider,
      config: (config ?? {}) as OAuthConfig,
      redirectUri: redirectUri(origin),
      state: flow.nonce,
      challenge,
    });
  } catch (e) {
    return back(e instanceof Error ? e.message : 'That provider is not configured yet.');
  }

  const res = NextResponse.redirect(dest);
  res.cookies.set(FLOW_COOKIE, b64e(flow), cookieOpts(origin));
  return res;
}
