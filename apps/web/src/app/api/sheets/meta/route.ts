import { getWorkspaceContext, createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ensureToken, fetchSpreadsheetMeta, SheetsAuthError, SheetsRateError } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sheets/meta?id=<spreadsheetId> — title + worksheet list.
 * The user pastes the spreadsheet URL; we extract the id client-side.
 */
export async function GET(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const id = (new URL(req.url).searchParams.get('id') ?? '').trim();
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) {
    return Response.json({ error: 'That does not look like a Google Sheets link or ID.' }, { status: 400 });
  }
  const admin = supabaseAdmin();
  const sb = await createClient();
  const token = await ensureToken(admin, sb, ctx.workspace.id);
  if (!token) {
    return Response.json({ error: 'Google connection expired. Reconnect your account.', code: 'auth_expired' }, { status: 401 });
  }
  try {
    const meta = await fetchSpreadsheetMeta(token, id);
    return Response.json(meta);
  } catch (e) {
    if (e instanceof SheetsAuthError) return Response.json({ error: e.message, code: 'auth_expired' }, { status: 401 });
    if (e instanceof SheetsRateError) return Response.json({ error: 'Google is rate limiting us — try again in a moment.', code: 'rate_limited' }, { status: 429 });
    return Response.json({ error: e instanceof Error ? e.message : 'Could not open the spreadsheet.' }, { status: 502 });
  }
}
