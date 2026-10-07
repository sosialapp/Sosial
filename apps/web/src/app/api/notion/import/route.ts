import { getWorkspaceContext } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getConnection, readToken, queryDatabaseRows, mapRowToDraft, getPageBodyText, safeFetchFile, type NotionMapping } from '@/lib/notion';
import { createPost } from '@/lib/posts';
import { extFor, mimeFor } from '@/lib/posts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/notion/import — create the import job and process the first
 * chunk.  PUT — process the next chunk (client-driven continuation: keeps
 * the import logic in this one module, resumable, no worker dependency).
 * Progress + results live on the notion_imports row the UI polls.
 */

const CHUNK_ROWS = 8;
const MAX_ROWS = 500;
const MAX_MEDIA_PER_ROW = 5;

async function authorize() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { error: Response.json({ error: 'Sign in first.' }, { status: 401 }) } as const;
  const admin = supabaseAdmin();
  const conn = await getConnection(admin, ctx.workspace.id);
  if (!conn) return { error: Response.json({ error: 'Connect Notion first.' }, { status: 400 }) } as const;
  const token = await readToken(admin, conn.access_secret_id);
  if (!token) return { error: Response.json({ error: 'Notion connection expired. Reconnect your account.', code: 'auth_expired' }, { status: 401 }) } as const;
  return { ctx, admin, conn, token } as const;
}

function summaryOf(result: Record<string, unknown>) {
  return {
    imported: Number(result.imported ?? 0),
    duplicates: Number(result.duplicates ?? 0),
    changed: Number(result.changed ?? 0),
    failed: Number(result.failed ?? 0),
    errors: (result.errors ?? []) as string[],
  };
}

/** Ingest mapped media through the storage pipeline; failures → warning. */
async function ingestMedia(
  admin: ReturnType<typeof supabaseAdmin>,
  workspaceId: string,
  clientId: string,
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
    const lower = res.name.toLowerCase();
    const kind: 'image' | 'video' = res.mime.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/.test(lower) ? 'video' : 'image';
    const ext = extFor(res.name, kind);
    const file = new File([new Uint8Array(res.bytes)], res.name || `notion-${Date.now()}.${ext}`, {
      type: res.mime || mimeFor(ext, kind),
    });
    files.push({ file, kind });
  }
  return files;
}

interface ImportResult {
  imported: number;
  duplicates: number;
  changed: number;
  failed: number;
  errors: string[];
  changed_rows?: string[];
}

async function processChunk(
  admin: ReturnType<typeof supabaseAdmin>,
  token: string,
  job: {
    id: string;
    workspace_id: string;
    database_id: string;
    database_title: string;
    mapping: unknown;
    cursor: string | null;
    result: Record<string, unknown>;
    progress_total: number;
    progress_done: number;
  },
  userId: string,
  role: string,
): Promise<void> {
  const mapping = job.mapping as NotionMapping;
  const result: ImportResult = {
    imported: Number(job.result.imported ?? 0),
    duplicates: Number(job.result.duplicates ?? 0),
    changed: Number(job.result.changed ?? 0),
    failed: Number(job.result.failed ?? 0),
    errors: (job.result.errors ?? []) as string[],
  };

  // Stop conditions: page cap or explicit end.
  if (job.progress_done >= Math.min(MAX_ROWS, job.progress_total || MAX_ROWS) && job.progress_total > 0) {
    await admin.from('notion_imports').update({ status: 'done', cursor: null, result, updated_at: new Date().toISOString() }).eq('id', job.id);
    return;
  }

  const { rows, nextCursor } = await queryDatabaseRows(token, job.database_id, job.cursor ?? undefined, 50);

  // Load existing source rows for dedupe in one query.
  const ids = rows.map((r) => r.id);
  const { data: existing } = await admin
    .from('post_sources')
    .select('external_row_id, content_hash, post_id, posts(status)')
    .eq('workspace_id', job.workspace_id)
    .eq('source_type', 'notion')
    .eq('source_id', job.database_id)
    .in('external_row_id', ids.length ? ids : ['__none__']);
  const existingMap = new Map(
    ((existing ?? []) as unknown as { external_row_id: string; content_hash: string; post_id: string; posts: { status: string } }[]).map((e) => [e.external_row_id, e]),
  );

  const channels = await (async () => {
    const { data } = await admin
      .from('connected_channels')
      .select('id, provider, display_name, handle')
      .eq('workspace_id', job.workspace_id)
      .eq('status', 'connected');
    return (data ?? []) as { id: string; provider: string; display_name: string | null; handle: string | null }[];
  })();

  let processed = 0;
  for (const row of rows) {
    processed++;
    if (job.progress_done + processed > MAX_ROWS) break;

    const prior = existingMap.get(row.id);
    if (prior) {
      // Duplicate page id: hash decides "already imported" vs "changed".
      const res = mapRowToDraft(row, mapping, null, channels);
      const newHash = res.ok && res.draft ? res.draft.contentHash : 'invalid';
      if (prior.content_hash === newHash) {
        result.duplicates++;
        continue;
      }
      // Changed upstream. Update only while the post is still a draft.
      if ((prior as { posts?: { status?: string } }).posts?.status === 'draft' && res.ok && res.draft) {
        await admin
          .from('posts')
          .update({ title: res.draft.title, body: res.draft.body })
          .eq('id', prior.post_id);
        await admin.from('post_sources').update({ content_hash: res.draft.contentHash }).eq('post_id', prior.post_id).eq('source_type', 'notion');
        result.imported++;
        result.changed++;
        continue;
      }
      result.changed++;
      (result.changed_rows as string[]) ?? (result.changed_rows = []);
      (result.changed_rows as string[]).push(`Page ${row.id.slice(0, 8)} changed after import — not updated (post no longer a draft).`);
      continue;
    }

    // New row: fetch page body when mapped, map, validate, create.
    let bodyText: string | null = null;
    if (mapping.content === '__page_body__') {
      try {
        bodyText = await getPageBodyText(token, row.id);
      } catch {
        bodyText = null;
      }
    }
    const res = mapRowToDraft(row, mapping, bodyText, channels);
    if (!res.ok || !res.draft) {
      result.failed++;
      result.errors.push(`Page ${row.id.slice(0, 8)}: ${res.errors.join(' ')}`.slice(0, 300));
      continue;
    }
    const draft = res.draft;

    try {
      const files = await ingestMedia(admin, job.workspace_id, row.id, draft.mediaUrls, draft.warnings);
      const mode = draft.scheduledAt ? 'schedule' : 'draft';
      const postId = await createPost(admin, {
        workspaceId: job.workspace_id,
        userId,
        role: role === 'owner' || role === 'admin' ? role : 'member',
        title: draft.title,
        body: draft.body,
        mode,
        scheduleIso: draft.scheduledAt,
        channels: channels.filter((c) => draft.channelIds.includes(c.id)) as never,
        files,
        timezone: undefined,
        clientId: `notion:${job.database_id}:${row.id}`,
        leadCheck: false,
      });
      await admin.from('post_sources').insert({
        workspace_id: job.workspace_id,
        post_id: postId,
        source_type: 'notion',
        source_id: job.database_id,
        external_row_id: row.id,
        content_hash: draft.contentHash,
      });
      result.imported++;
    } catch (e) {
      result.failed++;
      result.errors.push(`Page ${row.id.slice(0, 8)}: ${String(e instanceof Error ? e.message : 'import failed').slice(0, 200)}`);
    }
  }

  const total = Math.min(MAX_ROWS, (job.progress_total || 0) + 0);
  const newDone = job.progress_done + processed;
  const isEnd = !nextCursor || newDone >= MAX_ROWS || processed === 0;
  await admin
    .from('notion_imports')
    .update({
      progress_done: newDone,
      progress_total: isEnd ? newDone : Math.max(total, newDone + 1),
      cursor: isEnd ? null : nextCursor ?? null,
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

  let body: { database_id?: unknown; database_title?: unknown; mapping?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const databaseId = typeof body.database_id === 'string' ? body.database_id.replace(/-/g, '') : '';
  if (!/^[0-9a-f]{32}$/i.test(databaseId)) return Response.json({ error: 'Invalid database id.' }, { status: 400 });
  const mapping = (body.mapping ?? {}) as NotionMapping;
  if (!mapping.content) return Response.json({ error: 'Map a content field first.' }, { status: 400 });

  const { data: jobRow } = await admin
    .from('notion_imports')
    .insert({
      workspace_id: ctx.workspace.id,
      created_by: ctx.user.id,
      database_id: databaseId,
      database_title: String(body.database_title ?? ''),
      mapping,
      status: 'running',
      result: {},
    })
    .select('id, workspace_id, database_id, database_title, mapping, cursor, result, progress_total, progress_done')
    .single();
  if (!jobRow) return Response.json({ error: 'Could not start the import.' }, { status: 500 });

  try {
    await processChunk(admin, token, jobRow as never, ctx.user.id, ctx.workspace.role);
    const { data: updated } = await admin
      .from('notion_imports')
      .select('status, progress_total, progress_done, result')
      .eq('id', (jobRow as { id: string }).id)
      .single();
    return Response.json({ import_id: (jobRow as { id: string }).id, ...(updated as object) });
  } catch (e) {
    await admin
      .from('notion_imports')
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
  if (!importId) return Response.json({ error: 'import_id required.' }, { status: 400 });

  const { data: job } = await admin
    .from('notion_imports')
    .select('id, workspace_id, database_id, database_title, mapping, cursor, result, progress_total, progress_done, status')
    .eq('id', importId)
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();
  const j = job as { id: string; status: string; cursor: string | null } | null;
  if (!j) return Response.json({ error: 'Import not found.' }, { status: 404 });
  if (j.status !== 'running' || !j.cursor) {
    const { data: done } = await admin.from('notion_imports').select('status, progress_total, progress_done, result').eq('id', importId).single();
    return Response.json({ import_id: importId, ...(done as object) });
  }

  try {
    await processChunk(admin, token, j as never, ctx.user.id, ctx.workspace.role);
    const { data: updated } = await admin
      .from('notion_imports')
      .select('status, progress_total, progress_done, result')
      .eq('id', importId)
      .single();
    return Response.json({ import_id: importId, ...(updated as object) });
  } catch (e) {
    await admin
      .from('notion_imports')
      .update({ status: 'failed', error: String(e instanceof Error ? e.message : 'import failed').slice(0, 300) })
      .eq('id', importId);
    return Response.json({ error: e instanceof Error ? e.message : 'Import failed.' }, { status: 502 });
  }
}
