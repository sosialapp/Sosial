import { getWorkspaceContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getConnection, readToken, queryDatabaseRows, mapRowToDraft, getPageBodyText, type NotionMapping } from '@/lib/notion';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST /api/notion/preview — first N rows mapped + validated, no writes. */
export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const admin = supabaseAdmin();
  const conn = await getConnection(admin, ctx.workspace.id);
  if (!conn) return Response.json({ error: 'Connect Notion first.' }, { status: 400 });
  const token = await readToken(admin, conn.access_secret_id);
  if (!token) return Response.json({ error: 'Notion connection expired. Reconnect your account.', code: 'auth_expired' }, { status: 401 });

  let body: { database_id?: unknown; mapping?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const databaseId = typeof body.database_id === 'string' ? body.database_id.replace(/-/g, '') : '';
  if (!/^[0-9a-f]{32}$/i.test(databaseId)) return Response.json({ error: 'Invalid database id.' }, { status: 400 });
  const mapping = (body.mapping ?? {}) as NotionMapping;
  if (!mapping.content) return Response.json({ error: 'Map a content field first.' }, { status: 400 });

  try {
    const { rows } = await queryDatabaseRows(token, databaseId, undefined, 5);
    const channels = await (async () => {
      const { data } = await admin
        .from('connected_channels')
        .select('id, provider, display_name, handle')
        .eq('workspace_id', ctx.workspace.id)
        .eq('status', 'connected');
      return (data ?? []) as { id: string; provider: string; display_name: string | null; handle: string | null }[];
    })();

    const out = [];
    for (const row of rows) {
      let bodyText: string | null = null;
      if (mapping.content === '__page_body__') {
        try {
          bodyText = await getPageBodyText(token, row.id, 2000);
        } catch {
          bodyText = null;
        }
      }
      const res = mapRowToDraft(row, mapping, bodyText, channels);
      out.push({
        page_id: row.id,
        ok: res.ok,
        errors: res.errors,
        draft: res.ok
          ? {
              title: res.draft!.title,
              body: res.draft!.body.slice(0, 400),
              channels: res.draft!.channelIds,
              scheduled_at: res.draft!.scheduledAt,
              warnings: res.draft!.warnings,
              media_count: res.draft!.mediaUrls.length,
            }
          : null,
      });
    }
    return Response.json({ rows: out });
  } catch (e) {
    if (e instanceof Error && /expired or revoked|no longer shared/i.test(e.message)) {
      return Response.json({ error: e.message, code: 'auth_expired' }, { status: 401 });
    }
    return Response.json({ error: e instanceof Error ? e.message : 'Preview failed.' }, { status: 502 });
  }
}
