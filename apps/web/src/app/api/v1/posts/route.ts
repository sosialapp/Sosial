import { supabaseAdmin } from '@/lib/supabase/admin';
import { unauthorized, verifyApiKey } from '@/lib/apiAuth';
import { apiClientId, isValidIdempotencyKey } from '@/lib/apiKeys';
import { ALL_PROVIDERS } from '@/lib/providers';
import { createPost, fetchLiveChannels, friendlyLimit, mediaBlock } from '@/lib/posts';

export const dynamic = 'force-dynamic';

const STATUSES = new Set([
  'draft',
  'approval',
  'queued',
  'publishing',
  'sent',
  'partial',
  'failed',
]);

/** Recent posts — powers Zapier/Make polling triggers ("new sent post"). */
export async function GET(req: Request) {
  const ctx = await verifyApiKey(req);
  if (!ctx) return unauthorized();
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 20) || 20));
  const status = url.searchParams.get('status');
  if (status !== null && !STATUSES.has(status)) {
    return Response.json(
      { error: `Unknown status '${status}'.` },
      { status: 400 },
    );
  }
  const admin = supabaseAdmin();
  let q = admin
    .from('posts')
    .select('id, body, status, scheduled_at, created_at')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return Response.json({ error: 'Could not list posts.' }, { status: 500 });
  return Response.json({ posts: data ?? [] });
}

const MAX_MEDIA_FILES = 5;
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

function bad(msg: string): Response {
  return Response.json({ error: msg }, { status: 400 });
}

async function workspaceOwner(
  admin: ReturnType<typeof supabaseAdmin>,
  workspaceId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  return (data as { user_id: string } | null)?.user_id ?? null;
}

async function fetchMedia(urls: string[]): Promise<{ file: File; kind: 'image' | 'video' }[]> {
  const out: { file: File; kind: 'image' | 'video' }[] = [];
  for (let i = 0; i < urls.length; i++) {
    let u: URL;
    try {
      u = new URL(String(urls[i]));
    } catch {
      throw new Error(`media_urls[${i}] is not a valid URL.`);
    }
    if (u.protocol !== 'https:') throw new Error(`media_urls[${i}] must be an https URL.`);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    let res: Response;
    try {
      res = await fetch(u, { signal: ctrl.signal });
    } catch {
      clearTimeout(timer);
      throw new Error(`media_urls[${i}] could not be downloaded.`);
    }
    clearTimeout(timer);
    if (!res.ok) throw new Error(`media_urls[${i}] returned HTTP ${res.status}.`);
    const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const kind = ct.startsWith('image/') ? 'image' : ct.startsWith('video/') ? 'video' : null;
    if (!kind) throw new Error(`media_urls[${i}] must be an image or a video.`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_MEDIA_BYTES) throw new Error(`media_urls[${i}] exceeds 25 MB.`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_MEDIA_BYTES) throw new Error(`media_urls[${i}] exceeds 25 MB.`);
    const base = u.pathname.split('/').pop() || `media-${i}`;
    out.push({ file: new File([buf], base, { type: ct }), kind });
  }
  return out;
}

/**
 * Create a post — the Zapier/Make "create post" action. One call targets
 * every connected account of each listed provider. Retries with the same
 * idempotency_key return the original post.
 */
export async function POST(req: Request) {
  const ctx = await verifyApiKey(req);
  if (!ctx) return unauthorized();

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad('Body must be JSON.');
  }

  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (!text) return bad('`text` is required and must not be empty.');
  if (text.length > 10000) return bad('`text` must be 10,000 characters or fewer.');

  const mode =
    b.mode === 'now' || b.mode === 'draft' || b.mode === 'schedule'
      ? b.mode
      : typeof b.scheduled_at === 'string'
        ? 'schedule'
        : 'draft';

  let scheduleIso: string | null = null;
  if (mode === 'schedule') {
    if (typeof b.scheduled_at !== 'string' || Number.isNaN(Date.parse(b.scheduled_at))) {
      return bad('`scheduled_at` must be an ISO timestamp when mode is schedule.');
    }
    scheduleIso = new Date(b.scheduled_at).toISOString();
  }

  const providers = Array.isArray(b.channels)
    ? [...new Set(b.channels.filter((p): p is string => typeof p === 'string'))]
    : [];
  if (!providers.length) return bad('`channels` is required, e.g. ["instagram", "tiktok"].');
  const unknown = providers.filter((p) => !(ALL_PROVIDERS as string[]).includes(p));
  if (unknown.length) return bad(`Unknown channels: ${unknown.join(', ')}.`);

  let timezone: string | undefined;
  if (b.timezone !== undefined) {
    if (typeof b.timezone !== 'string') return bad('`timezone` must be an IANA name.');
    try {
      Intl.DateTimeFormat(undefined, { timeZone: b.timezone });
      timezone = b.timezone;
    } catch {
      return bad(`Unknown timezone '${b.timezone}'.`);
    }
  }

  const title = typeof b.title === 'string' ? b.title.slice(0, 200) : '';

  const rawUrls = b.media_urls === undefined ? [] : b.media_urls;
  if (!Array.isArray(rawUrls) || rawUrls.some((u) => typeof u !== 'string')) {
    return bad('`media_urls` must be an array of https URLs.');
  }
  if (rawUrls.length > MAX_MEDIA_FILES) return bad('At most 5 media_urls per post.');

  const admin = supabaseAdmin();
  const live = await fetchLiveChannels(admin, ctx.workspaceId);
  const chosen = live.filter((c) => providers.includes(c.provider));
  const missing = providers.filter((p) => !chosen.some((c) => c.provider === p));
  if (missing.length) {
    return bad(
      `No connected channel for: ${missing.join(', ')}. Connect it in Sosial first.`,
    );
  }

  let files: { file: File; kind: 'image' | 'video' }[];
  try {
    files = await fetchMedia(rawUrls as string[]);
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Could not fetch media.');
  }
  const blocked = mediaBlock(
    chosen.map((c) => c.provider),
    files.map((f) => ({ kind: f.kind })),
  );
  if (blocked) return bad(blocked.message);

  let clientId: string | undefined;
  if (b.idempotency_key !== undefined) {
    if (!isValidIdempotencyKey(b.idempotency_key)) {
      return bad('`idempotency_key` must be 1-128 characters with no spaces.');
    }
    clientId = apiClientId(ctx.keyId, b.idempotency_key);
    const { data: existing } = await admin
      .from('posts')
      .select('id, status, scheduled_at')
      .eq('client_id', clientId)
      .maybeSingle();
    if (existing) return Response.json({ ...(existing as object), deduped: true });
  }

  const author = ctx.createdBy ?? (await workspaceOwner(admin, ctx.workspaceId));
  if (!author) {
    return Response.json({ error: 'Workspace has no owner to attribute the post to.' }, { status: 500 });
  }

  let postId: string;
  try {
    postId = await createPost(admin, {
      workspaceId: ctx.workspaceId,
      userId: author,
      role: 'owner',
      title,
      body: text,
      mode,
      scheduleIso,
      channels: chosen,
      files,
      timezone,
      clientId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not create the post.';
    if (/POST_LIMIT|CHANNEL_LIMIT/.test(msg)) {
      return Response.json({ error: friendlyLimit(msg) }, { status: 402 });
    }
    return bad(friendlyLimit(msg));
  }

  const [{ data: post }, { data: targets }] = await Promise.all([
    admin.from('posts').select('id, status, scheduled_at').eq('id', postId).maybeSingle(),
    admin.from('post_targets').select('provider, channel_id, status').eq('post_id', postId),
  ]);
  return Response.json(
    { ...(post as object), targets: targets ?? [] },
    { status: 201 },
  );
}
