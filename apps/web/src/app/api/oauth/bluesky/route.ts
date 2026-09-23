import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/oauth/bluesky { workspace_id, handle, app_password }
 * Bluesky has no OAuth — handle + app password go straight to a session on
 * the account's own PDS (server-side, never stored), then import as usual.
 */
export async function POST(req: Request) {
  let body: { workspace_id?: unknown; handle?: unknown; app_password?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : '';
  const handle = typeof body.handle === 'string' ? body.handle.trim() : '';
  const appPassword = typeof body.app_password === 'string' ? body.app_password : '';
  if (!workspaceId) return Response.json({ error: 'Pick a workspace first.' }, { status: 400 });
  if (!handle) return Response.json({ error: 'Enter your Bluesky handle first.' }, { status: 400 });
  if (!appPassword) return Response.json({ error: 'Paste the app password too.' }, { status: 400 });

  const sb = await createClient();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) return Response.json({ error: 'Sign in first.' }, { status: 401 });

  const { data, error: fnErr } = await sb.functions.invoke('oauth-exchange', {
    body: { provider: 'bluesky', handle, app_password: appPassword },
  });
  const payload = (data ?? {}) as {
    error?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: string;
    external_id?: string;
    handle?: string;
    display_name?: string;
    instance_url?: string;
    metadata?: Record<string, string>;
  };
  const fail = payload.error ?? fnErr?.message;
  if (fail || !payload.access_token || !payload.external_id) {
    return Response.json({ error: fail ?? 'Bluesky login failed.' }, { status: 502 });
  }
  const { error: impErr } = await sb.functions.invoke('import-channel-token', {
    body: {
      workspace_id: workspaceId,
      provider: 'bluesky',
      external_id: payload.external_id,
      handle: payload.handle,
      display_name: payload.display_name,
      instance_url: payload.instance_url,
      metadata: payload.metadata ?? {},
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: payload.expires_at,
    },
  });
  if (impErr) return Response.json({ error: impErr.message }, { status: 502 });
  return Response.json({ ok: true });
}
