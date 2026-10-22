import { createClient } from '@/lib/supabase/server';
import { channelManageError } from '@/lib/channelAccess';

/**
 * POST /api/oauth/bluesky { workspace_id, handle, app_password }
 * Bluesky has no OAuth: handle + app password are verified against the
 * account's own PDS right here — no edge-function hop, so every refusal
 * comes back as plain JSON instead of a gateway error page. The verified
 * app password (not the short-lived session JWT) becomes the stored
 * credential; the sync engine mints fresh sessions from it per sweep.
 */

type Session = {
  accessJwt?: string;
  did?: string;
  handle?: string;
};

/** Accepts `name`, `name.bsky.social`, `@name`, a bsky.app profile URL or an email. */
function normalizeHandle(raw: string): string {
  let id = raw.trim();
  id = id.replace(/^https?:\/\/(?:www\.)?bsky\.app\/profile\//i, '');
  id = id.replace(/^https?:\/\//i, '');
  id = id.replace(/[?#].*$/, '');
  id = id.replace(/\/+$/, '');
  id = id.replace(/^@+/, '');
  if (!id || id.startsWith('did:') || id.includes('.') || id.includes('@')) return id;
  return `${id}.bsky.social`;
}

async function readJson(r: Response): Promise<Record<string, unknown>> {
  try {
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function resolvePds(did: string): Promise<string> {
  if (!did.startsWith('did:plc:')) return '';
  const dr = await fetch(`https://plc.directory/${encodeURIComponent(did)}`);
  const dj = await readJson(dr);
  const services = Array.isArray(dj.service) ? dj.service : [];
  const svc = services.find(
    (s: { id?: string; type?: string }) =>
      s?.id === '#atproto_pds' || s?.type === 'AtprotoPersonalDataServer',
  ) as { serviceEndpoint?: string } | undefined;
  return String(svc?.serviceEndpoint ?? '').replace(/\/+$/, '');
}

export async function POST(req: Request) {
  try {
    let body: { workspace_id?: unknown; handle?: unknown; app_password?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
    }
    const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : '';
    const handle = typeof body.handle === 'string' ? body.handle : '';
    const appPassword = typeof body.app_password === 'string' ? body.app_password.trim() : '';
    if (!workspaceId) return Response.json({ error: 'Pick a workspace first.' }, { status: 400 });
    if (!normalizeHandle(handle)) return Response.json({ error: 'Enter your Bluesky handle first.' }, { status: 400 });
    if (!appPassword) return Response.json({ error: 'Paste the app password too.' }, { status: 400 });

    const sb = await createClient();
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    const denied = await channelManageError(sb, workspaceId);
    if (denied) return Response.json({ error: denied }, { status: 403 });

    const identifier = normalizeHandle(handle);
    const isEmail = identifier.includes('@');
    let did = identifier;
    if (!did.startsWith('did:') && !isEmail) {
      const rr = await fetch(
        `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(identifier)}`,
      );
      const rj = await readJson(rr);
      if (!rj.did) {
        return Response.json({ error: `Could not find @${identifier} on Bluesky.` }, { status: 400 });
      }
      did = String(rj.did);
    }
    const pds = await resolvePds(did);
    if (!pds) {
      return Response.json({ error: "Could not find that account's server." }, { status: 400 });
    }
    const sr = await fetch(`${pds}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: isEmail ? identifier : did, password: appPassword }),
    });
    const sj = await readJson(sr) as Session & { message?: string };
    if (!sj.accessJwt) {
      return Response.json(
        {
          error:
            sj.message === 'Invalid identifier or password'
              ? 'Bluesky says that handle or app password is wrong. Create a fresh one at bsky.app → Settings → App passwords.'
              : `Bluesky refused the login (${sr.status}). ${String(sj.message ?? '').slice(0, 120)}`,
        },
        { status: 400 },
      );
    }
    const account = String(sj.did ?? did);
    const accountHandle = String(sj.handle ?? identifier).replace(/^@/, '');
    let avatar = '';
    try {
      const gr = await fetch(
        `${pds}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(account)}`,
        { headers: { Authorization: `Bearer ${String(sj.accessJwt)}` } },
      );
      const gj = await readJson(gr);
      if (typeof gj.avatar === 'string') avatar = gj.avatar;
    } catch {
      /* avatar is optional */
    }

    // Same account twice is a no-op with a name, but let expired rows heal.
    const { data: existing } = await sb
      .from('connected_channels')
      .select('id,status')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'bluesky')
      .eq('external_id', account)
      .maybeSingle();
    if (existing && (existing as { status?: string }).status === 'connected') {
      return Response.json({ already: true });
    }
    const { error: impErr } = await sb.functions.invoke('import-channel-token', {
      body: {
        workspace_id: workspaceId,
        provider: 'bluesky',
        external_id: account,
        handle: accountHandle,
        display_name: `@${accountHandle}`,
        instance_url: pds,
        metadata: { bluesky_handle: accountHandle, ...(avatar ? { avatar } : {}) },
        access_token: appPassword,
        token_type: 'AppPassword',
      },
    });
    if (impErr) return Response.json({ error: `Could not save the channel: ${impErr.message}` }, { status: 502 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: `Bluesky connect failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
