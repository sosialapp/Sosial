import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { redirectUri } from '@/lib/oauth';
import { FLOW_COOKIE, b64e, cookieOpts, type FlowState } from '@/lib/oauthServer';

/**
 * Username like "alice" lands on mastodon.social; a full server like
 * fosstodon.org is used as-is. Mirrors mobile normalizeInstance. Throws on junk.
 */
function normalizeInstance(input: string): string {
  let host = (input ?? '').trim().toLowerCase();
  host = host.replace(/^https?:\/\//, '').replace(/^@/, '').replace(/\/+$/, '');
  host = host.split('/')[0].split('?')[0];
  if (host && !host.includes('.')) return 'mastodon.social';
  if (!host || /\s/.test(host)) {
    throw new Error('Type your username, or a server like fosstodon.org.');
  }
  return host;
}

/**
 * POST /api/oauth/mastodon-start { workspace_id, instance }
 * Mastodon is federated — no portal keys. Register Sosial on the user's own
 * instance, stash the per-instance credentials in the flow cookie (httpOnly,
 * 10 minutes, same sensitivity as mobile's AsyncStorage), and hand back the
 * instance consent URL to open.
 */
export async function POST(req: Request) {
  let body: { workspace_id?: unknown; instance?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : '';
  if (!workspaceId) return NextResponse.json({ error: 'Pick a workspace first.' }, { status: 400 });

  let instance: string;
  try {
    instance = normalizeInstance(typeof body.instance === 'string' ? body.instance : '');
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Bad server address.' }, { status: 400 });
  }

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { data: mem } = await sb
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!mem) return NextResponse.json({ error: 'Not a member of this workspace.' }, { status: 403 });

  const origin = new URL(req.url).origin;
  const redir = redirectUri(origin);
  const base = `https://${instance}`;
  let clientId = '';
  let clientSecret = '';
  try {
    const r = await fetch(`${base}/api/v1/apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Sosial', redirect_uris: redir, scopes: 'read write' }),
    });
    const j = (await r.json().catch(() => ({}))) as { client_id?: string; client_secret?: string; error?: string };
    clientId = typeof j.client_id === 'string' ? j.client_id : '';
    clientSecret = typeof j.client_secret === 'string' ? j.client_secret : '';
    if (!clientId) throw new Error(typeof j.error === 'string' && j.error ? j.error : 'registration refused');
  } catch (e) {
    const why = e instanceof Error ? e.message : 'network unreachable';
    return NextResponse.json(
      { error: `Could not register on that server — check the address and try again. (${why})` },
      { status: 502 },
    );
  }

  const flow: FlowState = {
    provider: 'mastodon',
    workspace_id: workspaceId,
    nonce: randomBytes(16).toString('base64url'),
    instance,
    clientId,
    clientSecret,
  };
  const url =
    `${base}/oauth/authorize?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redir)}` +
    `&scope=${encodeURIComponent('read write')}` +
    `&state=${encodeURIComponent(flow.nonce)}`;
  const res = NextResponse.json({ url });
  res.cookies.set(FLOW_COOKIE, b64e(flow), cookieOpts(origin));
  return res;
}
