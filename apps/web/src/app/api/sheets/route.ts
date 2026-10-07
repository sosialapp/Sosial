import { getWorkspaceContext, createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getConnection } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

/** GET: connection status for the import UI. */
export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const admin = supabaseAdmin();
  const conn = await getConnection(admin, ctx.workspace.id);
  return Response.json({ connected: !!conn });
}

/** DELETE: disconnect — Vault secrets + row deleted; imported posts kept. */
export async function DELETE() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const admin = supabaseAdmin();
  const conn = await getConnection(admin, ctx.workspace.id);
  if (conn) {
    for (const sid of [conn.access_secret_id, conn.refresh_secret_id]) {
      try {
        await admin.rpc('vault_delete_secret', { secret_id: sid });
      } catch {
        /* orphan secret is inert */
      }
    }
    await admin.from('sheets_connections').delete().eq('id', conn.id).eq('workspace_id', ctx.workspace.id);
  }
  return Response.json({ disconnected: true });
}

/** POST: finish the OAuth popup (code) via sheets-auth edge fn. */
export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  let code = '';
  try {
    code = String(((await req.json()) as { code?: unknown }).code ?? '');
  } catch {
    return Response.json({ error: 'Body must be JSON with a code.' }, { status: 400 });
  }
  if (!code) return Response.json({ error: 'Missing code.' }, { status: 400 });

  const sb = await createClient();
  const { data, error } = await sb.functions.invoke('sheets-auth', {
    body: {
      workspace_id: ctx.workspace.id,
      code,
      redirect_uri: `${new URL(req.url).origin}/auth.html`,
    },
  });
  const payload = (data ?? {}) as { error?: string };
  if (error || payload.error) {
    return Response.json({ error: payload.error ?? 'Could not connect Google Sheets.' }, { status: 502 });
  }
  return Response.json({ connected: true });
}
