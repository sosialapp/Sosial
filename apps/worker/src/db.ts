/**
 * Supabase access over HTTPS (PostgREST + RPC) with the service_role key.
 * No pg driver — SKIP LOCKED lives inside the claim_job RPC, so this stays
 * a plain Node fetch client that Railway can run anywhere.
 */
import { required, env } from './env';

export interface Job {
  id: number;
  kind:
    | 'publish_target'
    | 'refresh_token'
    | 'snapshot_analytics'
    | 'cleanup_media'
    | 'send_invite'
    | 'sync_avatars'
    | 'send_push';
  payload: Record<string, any>;
  status: string;
  run_at: string;
  attempts: number;
  max_attempts: number;
}

let base = '';
let key = '';

export function initDb(): void {
  base = required('WORKER_SUPABASE_URL').replace(/\/+$/, '');
  key = required('WORKER_SERVICE_ROLE_KEY');
}

/** POST /rest/v1/rpc/{fn} with service_role auth. */
export async function callRpc<T>(fn: string, args: Record<string, any>): Promise<T> {
  const r = await fetch(`${base}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`rpc ${fn} failed (${r.status}): ${t.slice(0, 200)}`);
  }
  return (await r.json().catch(() => null)) as T;
}

/** Oldest due queued job, marked running — null when the queue is empty. */
export function claimJob(workerId: string): Promise<Job | null> {
  return callRpc<Job | null>('claim_job', { worker_id: workerId });
}

/** ok=true → done; else requeue with backoff, or dead when attempts run out. */
export function completeJob(jobId: number, ok: boolean, error?: string): Promise<void> {
  return callRpc<void>('complete_job', { job_id: jobId, ok, err: error ?? null });
}

/** Return a running job to the queue at a chosen time without burning an
 *  attempt — the daily-limit Gate B parks a job until its window reopens. */
export function deferJob(jobId: number, runAt: string): Promise<void> {
  return callRpc<void>('defer_job', { p_job_id: jobId, p_run_at: runAt });
}

/** Remaining posts this channel may send in its rolling 24h window
 *  (provider's cap minus already-sent; <= 0 means full). */
export function channelDailyRemaining(channelId: string, provider: string): Promise<number> {
  return callRpc<number>('channel_daily_remaining', {
    p_channel_id: channelId,
    p_provider: provider,
  });
}

/** When the channel's 24h window next frees up (oldest send + 24h), or null. */
export function channelDailyNextSlot(channelId: string): Promise<string | null> {
  return callRpc<string | null>('channel_daily_next_slot', { p_channel_id: channelId });
}

/** Read one secret's plaintext (ids from get_publish_bundle). */
export function readSecret(secretId: string): Promise<string | null> {
  return callRpc<string | null>('vault_read_secret', { secret_id: secretId });
}

/** Replace a secret's value in place (rotation keeps the same id). */
export function updateSecret(secretId: string, secret: string): Promise<void> {
  return callRpc<void>('vault_update_secret', { secret_id: secretId, secret });
}

/** Fetch the publish bundle for one target — null when unknown. */
export function getPublishBundle(targetId: string): Promise<any | null> {
  return callRpc<any | null>('get_publish_bundle', { target_id: targetId });
}

/* ------------------------------ send_invite ------------------------------ */

export interface InviteRow {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
}

/** Raw REST helper (service_role bypasses RLS — callers own authorization). */
export async function rest<T>(path: string, init?: any): Promise<T> {
  const r = await fetch(`${base}${path}`, {
    ...(init ?? {}),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...((init as any)?.headers ?? {}),
    },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`rest ${path} failed (${r.status}): ${t.slice(0, 200)}`);
  }
  return (await r.json().catch(() => null)) as T;
}

/** Invite row for the retry loop — null when deleted. */
export async function getInvite(inviteId: string): Promise<InviteRow | null> {
  const rows = await rest<InviteRow[]>(
    `/rest/v1/invites?id=eq.${encodeURIComponent(inviteId)}&select=id,email,token,expires_at,accepted_at`,
  );
  return rows?.[0] ?? null;
}

/* ----------------------------- cleanup_media ----------------------------- */

export interface MediaAssetRow {
  id: string;
  workspace_id: string;
  storage_path: string;
  status: string;
  pinned: boolean;
  storage_backend: string;
}

/** Media row for cleanup/delete flows — null when already deleted. */
export async function getMediaAsset(mediaId: string): Promise<MediaAssetRow | null> {
  const rows = await rest<MediaAssetRow[]>(
    `/rest/v1/media_assets?id=eq.${encodeURIComponent(mediaId)}&select=id,workspace_id,storage_path,status,pinned,storage_backend`,
  );
  return rows?.[0] ?? null;
}

/** Delete one media row; post_media links cascade, the post itself survives. */
export async function deleteMediaAsset(mediaId: string): Promise<void> {
  await rest<unknown>(`/rest/v1/media_assets?id=eq.${encodeURIComponent(mediaId)}`, {
    method: 'DELETE',
  });
}

function siteUrl(): string {
  return env('WORKER_SITE_URL', 'https://sosial.app').replace(/\/+$/, '');
}

/** Re-send an invite email (GoTrue admin invite is idempotent per email). */
export async function resendInviteEmail(invite: InviteRow): Promise<void> {
  await rest<unknown>('/auth/v1/admin/invite', {
    method: 'POST',
    body: JSON.stringify({
      email: invite.email,
      data: { invite_id: invite.id },
      redirect_to: `${siteUrl()}/invite/${invite.token}`,
    }),
  });
  await rest<unknown>(`/rest/v1/invites?id=eq.${encodeURIComponent(invite.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ emailed_at: new Date().toISOString() }),
  });
}

/** Terminal states on post_targets (cron only enqueues 'queued'). */
export function markTargetSent(targetId: string, remoteId: string, remoteUrl: string): Promise<void> {
  return callRpc<void>('mark_target_sent', {
    target_id: targetId,
    remote_id: remoteId,
    remote_url: remoteUrl,
  });
}

export function markTargetFailed(targetId: string, err: string): Promise<void> {
  return callRpc<void>('mark_target_failed', { target_id: targetId, err });
}
