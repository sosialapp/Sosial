import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConnectedChannel, PostWithTargets, WorkspaceInfo } from './types';

/** Ordered media + targets for every post in a workspace (RLS-scoped).
 *  Media bytes live in a private bucket, so each asset gets a short-lived
 *  signed URL for previews. */
export async function fetchPosts(sb: SupabaseClient, workspaceId: string): Promise<PostWithTargets[]> {
  const { data, error } = await sb
    .from('posts')
    .select(
      '*, post_targets(*), post_media(position, media_assets(id, workspace_id, storage_path, kind, mime_type, byte_size, status)), approvals(id, status, comment, created_at, decided_at)',
    )
    .eq('workspace_id', workspaceId)
    .order('scheduled_at', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as PostWithTargets[];
  const paths = new Set<string>();
  for (const p of rows) {
    for (const m of p.post_media ?? []) {
      if (m.media_assets?.storage_path) paths.add(m.media_assets.storage_path);
    }
  }
  if (paths.size) {
    const { data: signed } = await sb.storage.from('post-media').createSignedUrls([...paths], 3600);
    const byPath = new Map<string, string>();
    for (const s of (signed ?? []) as { path: string; signedUrl: string | null }[]) {
      if (s.signedUrl) byPath.set(s.path, s.signedUrl);
    }
    for (const p of rows) {
      for (const m of p.post_media ?? []) {
        if (m.media_assets) m.media_assets.signed_url = byPath.get(m.media_assets.storage_path);
      }
    }
  }
  return rows;
}

export async function fetchPostsLite(sb: SupabaseClient, workspaceId: string): Promise<PostWithTargets[]> {
  const { data, error } = await sb
    .from('posts')
    .select('*, post_targets(*), approvals(id, status, comment, created_at, decided_at)')
    .eq('workspace_id', workspaceId)
    .order('scheduled_at', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PostWithTargets[];
}

export async function fetchChannels(sb: SupabaseClient, workspaceId: string): Promise<ConnectedChannel[]> {  const { data, error } = await sb
    .from('connected_channels')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('provider', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ConnectedChannel[];
}

/* ------------------------------ mutations ------------------------------ */

export type ComposeMode = 'draft' | 'schedule' | 'now';

export interface ComposeArgs {
  workspaceId: string;
  userId: string;
  role: WorkspaceInfo['role'];
  title: string;
  body: string;
  mode: ComposeMode;
  scheduleIso: string | null;
  channels: ConnectedChannel[];
  files: { file: File; kind: 'image' | 'video' }[];
  /** P17 chains: segments of one thread share a chainId, ordered by chainPosition. */
  chainId?: string;
  chainPosition?: number;
  /** IANA zone the schedule was chosen in; defaults to the server's device zone. */
  timezone?: string;
}

export function extFor(name: string, kind: string): string {
  const m = name.toLowerCase().split('?')[0].match(/\.([a-z0-9]{2,4})$/);
  if (m) return m[1];
  return kind === 'video' ? 'mp4' : 'jpg';
}

export function mimeFor(ext: string, kind: string): string {
  if (kind === 'video') return ext === 'mov' ? 'video/quicktime' : 'video/mp4';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

export function newClientId(): string {
  return `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function deviceTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Create a post and its per-channel targets. Mirrors the mobile write path
 * (cloudPosts.pushPostToCloud) including its ordering rule: media + links
 * BEFORE targets, so the worker can never see a queued target whose media is
 * still missing. Returns the new post id.
 */
export async function createPost(sb: SupabaseClient, args: ComposeArgs): Promise<string> {
  const { workspaceId, userId, title, body, mode, channels, files } = args;
  const clientId = newClientId();
  const needsApproval = args.role === 'member' && mode !== 'draft';
  const scheduledIso =
    mode === 'now' ? new Date().toISOString() : mode === 'schedule' ? args.scheduleIso : null;
  const postStatus = mode === 'draft' ? 'draft' : needsApproval ? 'approval' : 'queued';
  const targetStatus = mode === 'draft' ? 'pending' : needsApproval ? 'needs_approval' : 'queued';

  const { data: prow, error: pErr } = await sb
    .from('posts')
    .upsert(
      {
        workspace_id: workspaceId,
        created_by: userId,
        client_id: clientId,
        title: title.trim(),
        body: body.trim(),
        status: postStatus,
        scheduled_at: scheduledIso,
        timezone: args.timezone ?? deviceTimezone(),
        chain_id: args.chainId ?? null,
        chain_position: args.chainPosition ?? 0,
      },
      { onConflict: 'client_id' },
    )
    .select('id')
    .single();
  if (pErr || !prow) throw new Error(`Could not save the post: ${pErr?.message ?? 'no row'}`);
  const postId = String((prow as { id: string }).id);

  // Media first — deterministic per-push stamp so a re-save never reuses a path.
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const linked: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const { file, kind } = files[i];
    const ext = extFor(file.name, kind);
    const mime = file.type || mimeFor(ext, kind);
    const path = `${workspaceId}/${clientId}/${i}-${stamp}.${ext}`;
    const up = await sb.storage.from('post-media').upload(path, file, { contentType: mime, upsert: true });
    if (up.error) throw new Error(`Media upload failed (${file.name}): ${up.error.message}`);
    const { data: ins, error: mErr } = await sb
      .from('media_assets')
      .insert({
        workspace_id: workspaceId,
        uploaded_by: userId,
        storage_path: path,
        kind,
        mime_type: mime,
        byte_size: file.size,
        status: 'ready',
      })
      .select('id')
      .single();
    if (mErr || !ins) throw new Error(`Could not record media (${file.name}): ${mErr?.message ?? 'no row'}`);
    linked.push(String((ins as { id: string }).id));
  }

  if (linked.length) {
    const { error: delErr } = await sb.from('post_media').delete().eq('post_id', postId);
    if (delErr) throw new Error(`Could not reset media links: ${delErr.message}`);
    for (let i = 0; i < linked.length; i++) {
      const { error: linkErr } = await sb
        .from('post_media')
        .insert({ post_id: postId, media_id: linked[i], position: i });
      if (linkErr) throw new Error(`Could not link media: ${linkErr.message}`);
    }
  }

  // Targets last (atomicity — see cloudPosts.ts).
  for (const ch of channels) {
    const { error: tErr } = await sb.from('post_targets').upsert(
      {
        post_id: postId,
        channel_id: ch.id,
        provider: ch.provider,
        caption: body.trim(),
        options: {},
        status: targetStatus,
        scheduled_at: scheduledIso,
        idempotency_key: `cloud:${clientId}:${ch.id}`,
      },
      { onConflict: 'post_id,channel_id' },
    );
    if (tErr) throw new Error(`Could not target ${ch.provider}: ${tErr.message}`);
  }

  if (needsApproval) {
    const { error: aErr } = await sb.from('approvals').insert({
      post_id: postId,
      workspace_id: workspaceId,
      requested_by: userId,
      status: 'pending',
    });
    if (aErr) throw new Error(`Could not request approval: ${aErr.message}`);
  }

  return postId;
}

export interface ChainSegmentInput {
  body: string;
  files: { file: File; kind: 'image' | 'video' }[];
}

export interface ChainArgs {
  workspaceId: string;
  userId: string;
  role: WorkspaceInfo['role'];
  segments: ChainSegmentInput[];
  mode: ComposeMode;
  /** Start instant for part 1 (schedule mode). Ignored for drafts. */
  startIso: string | null;
  /** Minutes between parts. */
  gapMinutes: number;
  channels: ConnectedChannel[];
}

/**
 * Create a threaded chain: one post row per segment sharing a chainId,
 * schedules staggered by gapMinutes so the minutely cron + worker publish
 * the parts in order with no worker changes. 'now' maps to a schedule
 * staggered from this instant. Returns the new post ids in order.
 */
export async function createChain(sb: SupabaseClient, args: ChainArgs): Promise<string[]> {
  const gapMs = Math.max(0, Math.min(1440, args.gapMinutes || 0)) * 60_000;
  const base =
    args.mode === 'now'
      ? Date.now()
      : args.startIso
        ? new Date(args.startIso).getTime()
        : null;
  if (args.mode !== 'draft' && (base === null || Number.isNaN(base))) {
    throw new Error('Choose a valid start date and time.');
  }
  const chainId = crypto.randomUUID();
  const ids: string[] = [];
  for (let i = 0; i < args.segments.length; i++) {
    const seg = args.segments[i];
    const iso =
      args.mode === 'draft' || base === null ? null : new Date(base + i * gapMs).toISOString();
    const id = await createPost(sb, {
      workspaceId: args.workspaceId,
      userId: args.userId,
      role: args.role,
      title: '',
      body: seg.body,
      mode: args.mode === 'now' ? 'schedule' : args.mode,
      scheduleIso: iso,
      channels: args.channels,
      files: seg.files,
      chainId,
      chainPosition: i,
    });
    ids.push(id);
  }
  return ids;
}

/** Move a post (and its still-queued targets) to a new instant. */
export async function reschedulePost(sb: SupabaseClient, postId: string, iso: string): Promise<void> {
  const { error } = await sb.from('posts').update({ scheduled_at: iso }).eq('id', postId);
  if (error) throw new Error(error.message);
  await sb
    .from('post_targets')
    .update({ scheduled_at: iso })
    .eq('post_id', postId)
    .in('status', ['queued', 'pending']);
}

/** Publish a draft right away: queue the post and its targets for this minute. */
export async function publishPostNow(sb: SupabaseClient, postId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await sb
    .from('posts')
    .update({ status: 'queued', scheduled_at: now })
    .eq('id', postId);
  if (error) throw new Error(error.message);
  const { error: tErr } = await sb
    .from('post_targets')
    .update({ status: 'queued', scheduled_at: now })
    .eq('post_id', postId)
    .in('status', ['pending', 'queued', 'failed']);
  if (tErr) throw new Error(tErr.message);
}

export async function deletePost(sb: SupabaseClient, postId: string): Promise<void> {
  const { error } = await sb.from('posts').delete().eq('id', postId);
  if (error) throw new Error(error.message);
}

/* ------------------------------ approvals ------------------------------ */

async function openApproval(
  sb: SupabaseClient,
  postId: string,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const { data: existing } = await sb
    .from('approvals')
    .select('id')
    .eq('post_id', postId)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) return;
  const { error } = await sb.from('approvals').insert({
    post_id: postId,
    workspace_id: workspaceId,
    requested_by: userId,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
}

/** Member: send a draft/post to an owner or admin for review. */
export async function submitForApproval(
  sb: SupabaseClient,
  args: { postId: string; workspaceId: string; userId: string },
): Promise<void> {
  const { error } = await sb.from('posts').update({ status: 'approval' }).eq('id', args.postId);
  if (error) throw new Error(error.message);
  await sb
    .from('post_targets')
    .update({ status: 'needs_approval' })
    .eq('post_id', args.postId)
    .in('status', ['pending', 'queued']);
  await openApproval(sb, args.postId, args.workspaceId, args.userId);
}

/** Owner/admin: approve — the post queues (or stays queued at its slot). */
export async function approvePost(
  sb: SupabaseClient,
  args: { postId: string; userId: string; comment?: string },
): Promise<void> {
  const now = new Date().toISOString();
  const { data: prow, error: rErr } = await sb
    .from('posts')
    .select('scheduled_at')
    .eq('id', args.postId)
    .single();
  if (rErr) throw new Error(rErr.message);
  const iso = (prow as { scheduled_at: string | null } | null)?.scheduled_at ?? now;

  const { error } = await sb
    .from('posts')
    .update({ status: 'queued', scheduled_at: iso })
    .eq('id', args.postId);
  if (error) throw new Error(error.message);
  await sb
    .from('post_targets')
    .update({ status: 'queued', scheduled_at: iso })
    .eq('post_id', args.postId)
    .in('status', ['needs_approval', 'pending']);
  await sb
    .from('approvals')
    .update({ status: 'approved', decided_by: args.userId, decided_at: now, comment: args.comment ?? null })
    .eq('post_id', args.postId)
    .eq('status', 'pending');
}

/** Owner/admin: send back with a comment — the post returns to drafts. */
export async function requestChanges(
  sb: SupabaseClient,
  args: { postId: string; userId: string; comment?: string },
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await sb.from('posts').update({ status: 'draft' }).eq('id', args.postId);
  if (error) throw new Error(error.message);
  await sb
    .from('post_targets')
    .update({ status: 'pending' })
    .eq('post_id', args.postId)
    .in('status', ['needs_approval', 'queued']);
  await sb
    .from('approvals')
    .update({
      status: 'changes_requested',
      decided_by: args.userId,
      decided_at: now,
      comment: args.comment ?? null,
    })
    .eq('post_id', args.postId)
    .eq('status', 'pending');
}
