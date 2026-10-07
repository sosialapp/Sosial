import { getWorkspaceContext, createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  ensureToken,
  fetchSheetRows,
  mapSheetRow,
  safeFetchFile,
  type SheetsMapping,
  type SheetsOptions,
  type SheetDraft,
} from '@/lib/sheets';
import { createPost, extFor, mimeFor } from '@/lib/posts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/sheets/import — start the job + first chunk.
 * PUT  /api/sheets/import — process the next chunk (resumable).
 * Dedupe via post_sources (source_type='sheets', source_id=spreadsheetId,
 * external_row_id=`r<rowNumber>`); content hash decides duplicate vs changed.
 * Row-number keys are inherently shift-prone: a shift surfaces as "changed",
 * which updates the draft — never a silent duplicate. No hidden-ID column
 * write-back in v1 (read-only scope), so this is the documented tradeoff.
 */

const MAX_ROWS = 2000;
const MAX_MEDIA_PER_ROW = 5;

interface ImportResult {
  imported: number;
  duplicates: number;
  changed: number;
  failed: number;
  errors: string[];
  invalid_rows: number[];
}

async function authorize() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { error: Response.json({ error: 'Sign in first.' }, { status: 401 }) } as const;
  const admin = supabaseAdmin();
  const sb = await createClient();
  const token = await ensureToken(admin, sb, ctx.workspace.id);
  if (!token) return { error: Response.json({ error: 'Google connection expired. Reconnect your account.', code: 'auth_expired' }, { status: 401 }) } as const;
  return { ctx, admin, token } as const;
}

async function ingestMedia(
  urls: string[],
  warnings: string[],
): Promise<{ file: File; kind: 'image' | 'video' }[]> {
  const files: { file: File; kind: 'image' | 'video' }[] = [];
  for (const url of urls.slice(0, MAX_MEDIA_PER_ROW)) {
    const res = await safeFetchFile(url);
    if ('error' in res) {
      warnings.push(`Media skipped: ${res.error}`);
      continue;
    }
    const kind: 'image' | 'video' = res.mime.startsWith('video/') ? 'video' : 'image';
    const ext = extFor(res.name, kind);
    files.push({
      file: new File([new Uint8Array(res.bytes)], res.name || `sheet-${Date.now()}.${ext}`, {
        type: res.mime || mimeFor(ext, kind),
      }),
      kind,
    });
  }
  return files;
}

async function processChunk(
  admin: ReturnType<typeof supabaseAdmin>,
  token: string,
  job: {
    id: string;
    workspace_id: string;
    spreadsheet_id: string;
    mapping: unknown;
    options: unknown;
    cursor: number | null;
    result: Record<string, unknown>;
    progress_total: number;
    progress_done: number;
  },
  userId: string,
  role: string,
): Promise<void> {
  const mapping = job.mapping as SheetsMapping;
  const options = job.options as SheetsOptions;
  const result: ImportResult = {
    imported: Number(job.result.imported ?? 0),
    duplicates: Number(job.result.duplicates ?? 0),
    changed: Number(job.result.changed ?? 0),
    failed: Number(job.result.failed ?? 0),
    errors: (job.result.errors ?? []) as string[],
    invalid_rows: (job.result.invalid_rows ?? []) as number[],
  };

  const startRow = job.cursor ?? Math.max(1, (options?.headerRow ?? 1) + 1);
  if (startRow > MAX_ROWS || (job.progress_total > 0 && job.progress_done >= Math.min(job.progress_total, MAX_ROWS))) {
    await admin.from('sheets_imports').update({ status: 'done', cursor: null, result, updated_at: new Date().toISOString() }).eq('id', job.id);
    return;
  }

  const { rows, nextStartRow } = await fetchSheetRows(token, job.spreadsheet_id, options.sheetTitle ?? 'Sheet1', startRow);

  const headerRow = options?.headerRow ?? 1;
  const dataRows = rows.slice(headerRow >= startRow ? headerRow - startRow + 1 : 0);

  const channelsRaw = await admin
    .from('connected_channels')
    .select('id, provider, display_name, handle')
    .eq('workspace_id', job.workspace_id)
    .eq('status', 'connected');
  const channels = ((channelsRaw.data ?? []) as { id: string; provider: string; display_name: string | null; handle: string | null }[]).map((c) => ({
    id: c.id,
    provider: c.provider,
    display_name: c.display_name,
    handle: c.handle,
    label: c.display_name || c.handle || c.provider,
  }));

  const rowNumbers = dataRows.map((_, i) => startRow + (headerRow >= startRow ? headerRow - startRow + 1 : 0) + i);
  const keys = rowNumbers.map((n) => `r${n}`);
  const { data: existing } = await admin
    .from('post_sources')
    .select('external_row_id, content_hash, post_id, posts(status)')
    .eq('workspace_id', job.workspace_id)
    .eq('source_type', 'sheets')
    .eq('source_id', job.spreadsheet_id)
    .in('external_row_id', keys.length ? keys : ['__none__']);
  const existingMap = new Map(
    ((existing ?? []) as unknown as { external_row_id: string; content_hash: string; post_id: string; posts: { status: string } }[]).map((e) => [e.external_row_id, e]),
  );

  let processed = 0;
  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = rowNumbers[i];
    if (!rowNumber || rowNumber > MAX_ROWS) break;
    processed++;
    const raw = dataRows[i];
    if (raw.every((c) => !c.trim())) continue; // blank row

    const prior = existingMap.get(`r${rowNumber}`);
    const res = mapSheetRow(rowNumber, raw, mapping, options, channels);
    const newHash = res.ok && res.draft ? res.draft.contentHash : 'invalid';

    if (prior) {
      if (prior.content_hash === newHash) {
        result.duplicates++;
        continue;
      }
      if (prior.posts?.status === 'draft' && res.ok && res.draft) {
        await admin.from('posts').update({ title: res.draft.title, body: res.draft.body }).eq('id', prior.post_id);
        await admin
          .from('post_sources')
          .update({ content_hash: res.draft.contentHash })
          .eq('post_id', prior.post_id)
          .eq('source_type', 'sheets');
        result.imported++;
        result.changed++;
        continue;
      }
      result.changed++;
      result.errors.push(`Row ${rowNumber} changed after import — not updated (post no longer a draft or row invalid).`);
      continue;
    }

    if (!res.ok || !res.draft) {
      result.failed++;
      result.invalid_rows.push(rowNumber);
      result.errors.push(`Row ${rowNumber}: ${res.errors.join(' ')}`.slice(0, 300));
      continue;
    }

    const draft: SheetDraft = res.draft;
    try {
      const warnings: string[] = [...draft.warnings];
      const files = await ingestMedia(draft.mediaUrls, warnings);
      const postId = await createPost(admin, {
        workspaceId: job.workspace_id,
        userId,
        role: role === 'owner' || role === 'admin' ? role : 'member',
        title: draft.title,
        body: draft.body,
        mode: draft.scheduledAt ? 'schedule' : 'draft',
        scheduleIso: draft.scheduledAt,
        channels: channels.filter((c) => draft.channelIds.includes(c.id)) as never,
        files,
        timezone: options?.timeZone,
        clientId: `sheets:${job.spreadsheet_id}:r${rowNumber}`,
        leadCheck: false,
      });
      await admin.from('post_sources').insert({
        workspace_id: job.workspace_id,
        post_id: postId,
        source_type: 'sheets',
        source_id: job.spreadsheet_id,
        external_row_id: `r${rowNumber}`,
        content_hash: draft.contentHash,
      });
      result.imported++;
    } catch (e) {
      result.failed++;
      result.invalid_rows.push(rowNumber);
      result.errors.push(`Row ${rowNumber}: ${String(e instanceof Error ? e.message : 'import failed').slice(0, 200)}`);
    }
  }

  const newDone = job.progress_done + processed;
  const isEnd = nextStartRow === null || newDone >= MAX_ROWS || processed === 0;
  await admin
    .from('sheets_imports')
    .update({
      progress_done: newDone,
      progress_total: isEnd ? newDone : Math.max(job.progress_total, nextStartRow ?? newDone),
      cursor: isEnd ? null : nextStartRow,
      result,
      status: isEnd ? 'done' : 'running',
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);
}

export async function POST(req: Request) {
  const auth = await authorize();
  if ('error' in auth) return auth.error;
  const { ctx, admin, token } = auth;

  let body: { spreadsheet_id?: unknown; spreadsheet_title?: unknown; sheet_title?: unknown; mapping?: unknown; options?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const spreadsheetId = typeof body.spreadsheet_id === 'string' ? body.spreadsheet_id.trim() : '';
  if (!/^[A-Za-z0-9_-]{10,}$/.test(spreadsheetId)) {
    return Response.json({ error: 'That does not look like a Google Sheets link or ID.' }, { status: 400 });
  }
  const mapping = body.mapping as SheetsMapping | undefined;
  const options = body.options as SheetsOptions | undefined;
  if (!mapping || mapping.contentCol === null || mapping.contentCol === undefined) {
    return Response.json({ error: 'Map a content column first.' }, { status: 400 });
  }

  const { data: jobRow } = await admin
    .from('sheets_imports')
    .insert({
      workspace_id: ctx.workspace.id,
      created_by: ctx.user.id,
      spreadsheet_id: spreadsheetId,
      spreadsheet_title: String(body.spreadsheet_title ?? ''),
      sheet_title: String(body.sheet_title ?? 'Sheet1'),
      mapping,
      options,
      status: 'running',
      result: {},
    })
    .select('id, workspace_id, spreadsheet_id, mapping, options, cursor, result, progress_total, progress_done')
    .single();
  if (!jobRow) return Response.json({ error: 'Could not start the import.' }, { status: 500 });

  try {
    await processChunk(admin, token, jobRow as never, ctx.user.id, ctx.workspace.role);
    const { data: updated } = await admin
      .from('sheets_imports')
      .select('status, progress_total, progress_done, result')
      .eq('id', (jobRow as { id: string }).id)
      .single();
    return Response.json({ import_id: (jobRow as { id: string }).id, ...(updated as object) });
  } catch (e) {
    await admin
      .from('sheets_imports')
      .update({ status: 'failed', error: String(e instanceof Error ? e.message : 'import failed').slice(0, 300) })
      .eq('id', (jobRow as { id: string }).id);
    return Response.json({ error: e instanceof Error ? e.message : 'Import failed.' }, { status: 502 });
  }
}

export async function PUT(req: Request) {
  const auth = await authorize();
  if ('error' in auth) return auth.error;
  const { ctx, admin, token } = auth;

  let importId = '';
  try {
    importId = String(((await req.json()) as { import_id?: unknown }).import_id ?? '');
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const { data: job } = await admin
    .from('sheets_imports')
    .select('id, workspace_id, spreadsheet_id, mapping, options, cursor, result, progress_total, progress_done, status')
    .eq('id', importId)
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();
  const j = job as { id: string; status: string; cursor: number | null } | null;
  if (!j) return Response.json({ error: 'Import not found.' }, { status: 404 });
  if (j.status !== 'running' || j.cursor === null) {
    const { data: done } = await admin.from('sheets_imports').select('status, progress_total, progress_done, result').eq('id', importId).single();
    return Response.json({ import_id: importId, ...(done as object) });
  }
  try {
    await processChunk(admin, token, j as never, ctx.user.id, ctx.workspace.role);
    const { data: updated } = await admin
      .from('sheets_imports')
      .select('status, progress_total, progress_done, result')
      .eq('id', importId)
      .single();
    return Response.json({ import_id: importId, ...(updated as object) });
  } catch (e) {
    await admin
      .from('sheets_imports')
      .update({ status: 'failed', error: String(e instanceof Error ? e.message : 'import failed').slice(0, 300) })
      .eq('id', importId);
    return Response.json({ error: e instanceof Error ? e.message : 'Import failed.' }, { status: 502 });
  }
}
