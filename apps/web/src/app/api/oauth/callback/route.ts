import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { channelManageError } from '@/lib/channelAccess';
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
 * supabase-js throws FunctionsHttpError("Edge Function returned a non-2xx
 * status code") with the server's JSON body on `context` — dig out our
 * `error` message so the user sees the real reason, not the generic text.
 */
async function edgeDetail(err: unknown): Promise<string | null> {
  try {
    const ctx = (err as { context?: unknown }).context;
    const res = ctx as Response | null;
    const body =
      res && typeof res.json === 'function'
        ? await (typeof res.clone === 'function' ? res.clone() : res)
            .json()
            .catch(() => null)
        : (ctx as { error?: unknown } | null);
    const msg = (body as { error?: unknown } | null)?.error;
    return typeof msg === 'string' && msg ? msg : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/oauth/callback?code=…&state=…
 * Provider landing: verify the flow cookie, exchange the code server-side,
 * import the channel, and bounce back to /channels with the result.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const incomingState = url.searchParams.get('state');

  // Media-source picker landing (state `cloud:<provider>:<nonce>` from the
  // composer's add-media dialog) and the Notion content-source connect popup.
  // Nothing is imported or persisted here — the code is posted to the opener,
  // which swaps it through the matching route. The opener matches on nonce.
  if (incomingState?.startsWith('cloud:')) {
    return cloudPickerResult(url, origin);
  }
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
  const denied = await channelManageError(sb, flow.workspace_id);
  if (denied) return done(`?error=${encodeURIComponent(denied)}`);

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
  const fail = payload.error ?? (await edgeDetail(fnErr)) ?? fnErr?.message;
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

  // Reddit posts per-subreddit — stash tokens + subs, the panel picks one.
  if (flow.provider === 'reddit') {
    const rd = payload as ExchangePayload & {
      subreddits?: { name: string; title: string; subscribers?: number }[];
    };
    if (!payload.access_token) {
      return done(`?error=${encodeURIComponent('Reddit hid the login — try connecting again.')}`);
    }
    const username =
      typeof payload.metadata?.redditUser === 'string' && payload.metadata.redditUser
        ? payload.metadata.redditUser
        : String(payload.display_name ?? '').replace(/^u\//, '');
    const pick: PickState = {
      workspace_id: flow.workspace_id,
      nonce: flow.nonce,
      pages: [],
      reddit: {
        username,
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        expires_at: payload.expires_at,
        avatar: payload.metadata?.avatar,
        subreddits: Array.isArray(rd.subreddits) ? rd.subreddits : [],
      },
    };
    const res = NextResponse.redirect(`${origin}/channels?connect=reddit`);
    res.cookies.delete(FLOW_COOKIE);
    res.cookies.set(PICK_COOKIE, b64e(pick), cookieOpts(origin));
    return res;
  }

  // GBP posts per-location — stash tokens + locations, the panel picks one.
  if (flow.provider === 'gmb') {
    const gg = payload as ExchangePayload & { locations?: { name: string; title: string }[] };
    if (!payload.access_token || !Array.isArray(gg.locations)) {
      return done(`?error=${encodeURIComponent('Google hid the login — try connecting again.')}`);
    }
    const pick: PickState = {
      workspace_id: flow.workspace_id,
      nonce: flow.nonce,
      pages: [],
      gmb: {
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        expires_at: payload.expires_at,
        locations: gg.locations,
      },
    };
    const res = NextResponse.redirect(`${origin}/channels?connect=gmb`);
    res.cookies.delete(FLOW_COOKIE);
    res.cookies.set(PICK_COOKIE, b64e(pick), cookieOpts(origin));
    return res;
  }

  if (!payload.access_token || !payload.external_id) {
    return done(`?error=${encodeURIComponent('The provider hid the account — try again.')}`);
  }

  // Ghost sweep (instagram/threads only): a past id-less exchange may have
  // left a username-keyed row for this same @handle. Usernames are globally
  // unique on those networks, so same display_name + different key ⇒ stale
  // ghost. Best-effort — never breaks the connect.
  if (
    (flow.provider === 'instagram' || flow.provider === 'threads') &&
    payload.display_name &&
    payload.external_id
  ) {
    try {
      const { data: siblings } = await sb
        .from('connected_channels')
        .select('external_id')
        .eq('workspace_id', flow.workspace_id)
        .eq('provider', flow.provider)
        .eq('display_name', payload.display_name)
        .neq('external_id', payload.external_id);
      for (const sib of (siblings ?? []) as { external_id: string }[]) {
        if (!sib.external_id) continue;
        await sb.functions.invoke('remove-channel-token', {
          body: { workspace_id: flow.workspace_id, provider: flow.provider, external_id: sib.external_id },
        });
      }
    } catch {
      /* sweep is hygiene, not the connect itself */
    }
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
  if (impErr) return done(`?error=${encodeURIComponent((await edgeDetail(impErr)) ?? impErr.message)}`);
  return done(`?connected=${flow.provider}`);
}

/**
 * Media-source picker landing (state `cloud:<provider>:<nonce>` from the
 * composer's "add media" dialog). Swaps the code for tokens via
 * cloud-exchange — nothing is imported or stored — and hands the result to
 * the opener window, which keeps tokens in sessionStorage (device-only).
 */
async function cloudPickerResult(url: URL, origin: string) {
  const page = (payload: Record<string, unknown>) => {
    const safe = JSON.stringify(payload).replace(/</g, '\\u003c');
    return new Response(
      `<!doctype html><html><body><script>` +
        // BroadcastChannel first: survives severed window.opener (provider
        // COOP headers can null it on the way back). Opener postMessage kept
        // as the fallback for older browsers.
        `try{var bc=new BroadcastChannel("sosial-cloud");bc.postMessage(${safe});bc.close();}catch(e){}` +
        `try{window.opener&&window.opener.postMessage(${safe},"${origin}");}catch(e){}` +
        `setTimeout(function(){window.close();},400);` +
        `document.body.innerHTML="<p style='font-family:sans-serif'>Done — you can close this tab.</p>";` +
        `</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  };
  const fail = (msg: string, nonce: string) =>
    page({ type: 'sosial-cloud', nonce, ok: false, error: msg });

  const [, provider, nonce] = (url.searchParams.get('state') ?? '').split(':');
  if ((provider !== 'dropbox' && provider !== 'google' && provider !== 'canva' && provider !== 'notion' && provider !== 'sheets') || !nonce) {
    return fail('That login expired — try connecting again.', '');
  }
  const providerErr = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  if (providerErr || !code) {
    return fail(
      url.searchParams.get('error_description') || 'The provider refused the login.',
      nonce,
    );
  }
  // Canva uses PKCE: the verifier lives in the opener's memory and must
  // never travel in a URL, so hand the code back and let the dialog finish
  // the exchange itself via cloud-exchange. Notion connect posts the code to
  // /api/notion (which exchanges it server-side through notion-connect).
  // Sheets connect posts the code to /api/sheets (sheets-auth edge fn).
  if (provider === 'canva' || provider === 'notion' || provider === 'sheets') {
    return page({ type: 'sosial-cloud', nonce, ok: true, code });
  }
  const sb = await createClient();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) return fail('Sign in first.', nonce);
  const { data, error: fnErr } = await sb.functions.invoke('cloud-exchange', {
    body: { provider, code, redirect_uri: `${origin}/auth.html` },
  });
  const tokens = (data ?? {}) as { access_token?: string; refresh_token?: string; expires_in?: number };
  const errMsg =
    (data as { error?: string } | null)?.error ?? (await edgeDetail(fnErr)) ?? fnErr?.message;
  if (errMsg || !tokens.access_token) {
    return fail(errMsg || 'The provider hid the login — try again.', nonce);
  }
  return page({
    type: 'sosial-cloud',
    nonce,
    ok: true,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_in: tokens.expires_in ?? 14400,
  });
}
