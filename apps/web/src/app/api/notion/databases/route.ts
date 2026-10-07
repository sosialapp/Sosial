import { getWorkspaceContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getConnection, readToken, searchDatabases, NotionAuthError, NotionRateError } from '@/lib/notion';

export const dynamic = 'force-dynamic';

/** GET /api/notion/databases?q=&cursor= — paginated database discovery. */
export async function GET(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const admin = supabaseAdmin();
  const conn = await getConnection(admin, ctx.workspace.id);
  if (!conn) return Response.json({ error: 'Connect Notion first.', code: 'not_connected' }, { status: 400 });
  const token = await readToken(admin, conn.access_secret_id);
  if (!token) return Response.json({ error: 'Notion connection expired. Reconnect your account.', code: 'auth_expired' }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').slice(0, 120);
  const cursor = url.searchParams.get('cursor') ?? undefined;
  try {
    const res = await searchDatabases(token, q, cursor || undefined);
    return Response.json(res);
  } catch (e) {
    if (e instanceof NotionAuthError) return Response.json({ error: e.message, code: 'auth_expired' }, { status: 401 });
    if (e instanceof NotionRateError) return Response.json({ error: 'Notion is rate limiting us — try again in a moment.', code: 'rate_limited' }, { status: 429 });
    return Response.json({ error: e instanceof Error ? e.message : 'Could not list databases.' }, { status: 502 });
  }
}
