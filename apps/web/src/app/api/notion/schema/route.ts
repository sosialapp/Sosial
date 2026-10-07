import { getWorkspaceContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getConnection, readToken, getDatabaseSchema, NotionAuthError } from '@/lib/notion';

export const dynamic = 'force-dynamic';

/** GET /api/notion/schema?id=<database id> — property list for mapping. */
export async function GET(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{32}$/i.test(id.replace(/-/g, ''))) {
    return Response.json({ error: 'Invalid database id.' }, { status: 400 });
  }
  const admin = supabaseAdmin();
  const conn = await getConnection(admin, ctx.workspace.id);
  if (!conn) return Response.json({ error: 'Connect Notion first.' }, { status: 400 });
  const token = await readToken(admin, conn.access_secret_id);
  if (!token) return Response.json({ error: 'Notion connection expired. Reconnect your account.', code: 'auth_expired' }, { status: 401 });
  try {
    const schema = await getDatabaseSchema(token, id);
    return Response.json(schema);
  } catch (e) {
    if (e instanceof NotionAuthError) return Response.json({ error: e.message, code: 'auth_expired' }, { status: 401 });
    return Response.json({ error: e instanceof Error ? e.message : 'Could not read the database.' }, { status: 502 });
  }
}
