import { getWorkspaceContext, createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ensureToken, fetchSheetRows, mapSheetRow, suggestMapping, type SheetsMapping, type SheetsOptions } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/sheets/preview — read the first rows, auto-suggest mapping from
 * the header, and return raw rows (for the mapping UI) plus validated
 * drafts. No writes. `start_row` lets the UI page through larger sheets.
 */
export async function POST(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const admin = supabaseAdmin();
  const sb = await createClient();
  const token = await ensureToken(admin, sb, ctx.workspace.id);
  if (!token) {
    return Response.json({ error: 'Google connection expired. Reconnect your account.', code: 'auth_expired' }, { status: 401 });
  }

  let body: {
    spreadsheet_id?: unknown;
    sheet_title?: unknown;
    start_row?: unknown;
    mapping?: unknown;
    options?: unknown;
    preview_only?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const spreadsheetId = typeof body.spreadsheet_id === 'string' ? body.spreadsheet_id.trim() : '';
  const sheetTitle = typeof body.sheet_title === 'string' && body.sheet_title ? body.sheet_title : 'Sheet1';
  const startRow = Math.max(1, Number(body.start_row ?? 1) || 1);
  if (!/^[A-Za-z0-9_-]{10,}$/.test(spreadsheetId)) {
    return Response.json({ error: 'That does not look like a Google Sheets link or ID.' }, { status: 400 });
  }
  const options: SheetsOptions = {
    timeZone: (body.options as SheetsOptions | undefined)?.timeZone || 'UTC',
    dateOrder: (body.options as SheetsOptions | undefined)?.dateOrder || 'auto',
    headerRow: Math.max(1, (body.options as SheetsOptions | undefined)?.headerRow ?? 1),
  };

  try {
    const { rows } = await fetchSheetRows(token, spreadsheetId, sheetTitle, startRow);
    const header = rows[options.headerRow - 1] ?? [];

    let mapping: SheetsMapping;
    if (body.mapping && typeof body.mapping === 'object') {
      mapping = body.mapping as SheetsMapping;
    } else {
      mapping = suggestMapping(header);
    }

    const channelsRaw = await admin
      .from('connected_channels')
      .select('id, provider, display_name, handle')
      .eq('workspace_id', ctx.workspace.id)
      .eq('status', 'connected');
    const channels = ((channelsRaw.data ?? []) as { id: string; provider: string; display_name: string | null; handle: string | null }[]).map((c) => ({
      id: c.id,
      provider: c.provider,
      display_name: c.display_name,
      handle: c.handle,
      label: c.display_name || c.handle || c.provider,
    }));

    const dataRows = rows.slice(options.headerRow - startRow >= 0 ? options.headerRow - startRow : 0);
    const out = [];
    let rowIndex = Math.max(options.headerRow + 1, startRow);
    for (const r of dataRows) {
      const res = mapSheetRow(rowIndex, r, mapping, options, channels);
      out.push({
        row: rowIndex,
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
      rowIndex++;
    }

    return Response.json({
      header,
      suggested: body.mapping ? undefined : mapping,
      rows: out,
      next_start_row: rowIndex > startRow ? rowIndex : null,
    });
  } catch (e) {
    if (e instanceof Error && /expired|gone or not shared/i.test(e.message)) {
      return Response.json({ error: e.message, code: 'auth_expired' }, { status: 401 });
    }
    return Response.json({ error: e instanceof Error ? e.message : 'Preview failed.' }, { status: 502 });
  }
}
