import { getWorkspaceContext, createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ensureToken, fetchSheetRows, mapSheetRow, sheetDataSlice, suggestMapping, type SheetsMapping, type SheetsOptions } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Same page cap as lib/sheets.ts: never preview beyond the importable range. */
const MAX_ROWS = 2000;

/**
 * POST /api/sheets/preview, read the first rows, auto-suggest mapping from
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
    const { rows, nextStartRow } = await fetchSheetRows(token, spreadsheetId, sheetTitle, startRow);
    // The header only lives in the first chunk; paged calls keep the mapping
    // they were given and must not re-derive it from a data row.
    const header = startRow === 1 ? (rows[options.headerRow - 1] ?? []) : [];

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

    const { rows: dataRows, offset } = sheetDataSlice(rows, options.headerRow, startRow);
    const out = [];
    for (let i = 0; i < dataRows.length; i++) {
      const rowNumber = startRow + offset + i;
      if (rowNumber > MAX_ROWS) break;
      const r = dataRows[i];
      // fetchSheetRows pads the chunk to CHUNK_ROWS; the padding is not data.
      if (r.every((c) => !c.trim())) continue;
      const res = mapSheetRow(rowNumber, r, mapping, options, channels);
      out.push({
        row: rowNumber,
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

    return Response.json({
      header,
      suggested: body.mapping || startRow > 1 ? undefined : mapping,
      rows: out,
      next_start_row: nextStartRow,
    });
  } catch (e) {
    if (e instanceof Error && /expired|gone or not shared/i.test(e.message)) {
      return Response.json({ error: e.message, code: 'auth_expired' }, { status: 401 });
    }
    return Response.json({ error: e instanceof Error ? e.message : 'Preview failed.' }, { status: 502 });
  }
}
