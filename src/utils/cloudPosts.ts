import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseUrl, currentSession, callEdgeFunction } from './supabase';
import { activeWorkspaceId, scopedKey } from './activeWorkspace';
import { uploadMediaFromFile } from './mediaUpload';
import { loadManagedPosts, saveManagedPostLocal, deleteManagedPost, postAttachments, type ManagedPost, type MediaAttachment } from './managed';
import { isChainPlatform } from './thread';
import { loadAccounts } from './metaStore';
import { findAccount, findAccountForProvider, accountExternalId, asIdList, type ConnectedAccount, type ProviderKey } from './socialAccounts';

/**
 * App → cloud write path (post-Wave-A slice). Every local save/delete
 * mirrors to Supabase best-effort: the device is source of truth, the cloud
 * is a follower. Never throws, callers fire-and-forget after local write.
 *
 * Identity: posts.client_id = local ManagedPost.id (P3 unique key), so
 * re-saves upsert instead of duplicating. Media uses deterministic storage
 * paths (<workspace>/<client_id>/<index>.<ext>), uploaded natively.
 */

function deviceTimezone(): string | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' && tz ? tz : undefined;
  } catch {
    return undefined;
  }
}

type CloudStatus = 'draft' | 'approval' | 'queued' | 'publishing' | 'sent' | 'partial' | 'failed';

function mapStatus(p: ManagedPost): CloudStatus {
  if (p.status === 'sent') return 'sent';
  if (p.status === 'approval') return 'approval';
  if (p.status === 'queued' || p.scheduledAt) return 'queued';
  return 'draft';
}

/**
 * Target-level twin of mapStatus. post_targets has no 'draft'/'approval' -
 * those are 'pending'/'needs_approval' per leg, so reusing the post status
 * violates post_targets_status_check and the whole push fails loudly.
 */
function mapTargetStatus(p: ManagedPost): 'pending' | 'needs_approval' | CloudStatus {
  const s = mapStatus(p);
  if (s === 'draft') return 'pending';
  if (s === 'approval') return 'needs_approval';
  return s;
}

/** Grid thumbnail: shrink to <=640px on the long edge, encode WebP. */
async function makeThumb(uri: string): Promise<string | null> {
  try {
    const probe: any = await manipulateAsync(uri, []);
    const long = Math.max(probe.width ?? 0, probe.height ?? 0, 1);
    const scale = Math.min(1, 640 / long);
    const actions =
      scale < 1
        ? [{ resize: { width: Math.max(1, Math.round((probe.width ?? long) * scale)), height: Math.max(1, Math.round((probe.height ?? long) * scale)) } }]
        : [];
    const out = await manipulateAsync(uri, actions, { compress: 0.8, format: SaveFormat.WEBP });
    return out.uri;
  } catch {
    return null;
  }
}

/** Mirror one local post (idempotent by client_id). Resolves when done. */
export async function pushPostToCloud(post: ManagedPost): Promise<void> {
  const session = await currentSession().catch(() => null);
  if (!session) {
    console.log('[cloud] skip push, signed out');
    return; // signed out: local-only, syncs on next save after sign-in
  }
  const sb = supabase();
  const wsId = session.workspace.id;
  const userId = session.user.id;
  const status = mapStatus(post);
  const targetStatus = mapTargetStatus(post);
  const scheduledIso =
    typeof post.scheduledAt === 'number' && post.scheduledAt > 0
      ? new Date(post.scheduledAt).toISOString()
      : null;

  // Post row (upsert on client_id, the P3 idempotency key).
  const { data: prow, error: pErr } = await sb
    .from('posts')
    .upsert(
      {
        workspace_id: wsId,
        created_by: userId,
        client_id: post.id,
        title: post.title ?? '',
        body: post.body ?? '',
        status,
        scheduled_at: scheduledIso,
        timezone: post.timezone ?? deviceTimezone(),
      },
      { onConflict: 'client_id' },
    )
    .select('id')
    .single();
  if (pErr || !prow) throw new Error(`cloud post upsert failed: ${pErr?.message ?? 'no row'}`);
  const postId = String((prow as any).id);

  // Cloud channels for this workspace, keyed two ways so a post can target a
  // SPECIFIC account's channel (provider + external_id) and still fall back to
  // the first row when there's no account hint (e.g. YouTube has no stored id).
  const { data: chans, error: chansErr } = await sb
    .from('connected_channels')
    .select('id, provider, external_id')
    .eq('workspace_id', wsId)
    .eq('status', 'connected');
  if (chansErr) console.log('[cloud] channels lookup failed:', chansErr.message);
  const byKey = new Map<string, string>();
  const byProvider = new Map<string, string>();
  for (const c of (chans ?? []) as any[]) {
    const provider = String(c.provider);
    const id = String(c.id);
    const ext = c.external_id ? String(c.external_id) : '';
    if (!byProvider.has(provider)) byProvider.set(provider, id);
    if (ext) byKey.set(`${provider}:${ext}`, id);
  }

  // Resolve the accounts a platform leg should publish to: the accounts
  // picked in the composer, else the primary account for that provider,
  // else any account.
  const accounts = await loadAccounts();
  const accountsFor = (platform: string): ConnectedAccount[] => {
    const picked = asIdList(post.accountIds?.[platform])
      .map((aid) => findAccount(accounts, aid))
      .filter((a): a is ConnectedAccount => !!a);
    if (picked.length > 0) return picked;
    const def = findAccount(accounts, `acct_${platform}`);
    if (def) return [def];
    const any = findAccountForProvider(accounts, platform as ProviderKey);
    return any ? [any] : [];
  };

  // ORDER MATTERS (atomicity): media uploads + asset rows FIRST, targets
  // LAST. If any media step throws, no targets exist, so the worker can
  // never publish a half-built (e.g. text-only) post, the failure stays
  // loud in Metro instead of masquerading as success.

  // Media: canonical accessor only, `attachments` already contains EVERY
  // item, and legacy imageUri/videoUri just mirror it. Concatenating all
  // three uploaded each mirrored file twice (2 rows → worker saw "2 videos").
  //
  // Paths are unique per push (position + timestamp + random): re-saving the
  // same post id with a REPLACED video must never overwrite-or-reuse the old
  // object. The old index-based scheme (`<index>.<ext>`) meant a swapped mp4
  // kept the same storage path, so a slow/in-flight push left Instagram and
  // Threads resolving the PREVIOUS video for the new post.
  const atts = postAttachments(post).slice(0, 10);
  const linked: string[] = [];
  const newPaths: string[] = [];
  /** True when at least one attachment is an existing cloud row. */
  let reusedCloudMedia = false;
  for (const a of atts) {
    if (linked.length >= 10) continue;
    // Pulled draft media keeps its media_assets row: link it, never re-upload
    // (the uri may be a signed URL, not a file on this device).
    if (a?.mediaId) {
      linked.push(a.mediaId);
      reusedCloudMedia = true;
      continue;
    }
    if (!a?.uri) continue;
    const kind: 'image' | 'video' = a.kind === 'video' ? 'video' : 'image';
    let thumbUri: string | undefined;
    let width: number | undefined;
    let height: number | undefined;
    if (kind === 'image') {
      try {
        const probe: any = await manipulateAsync(a.uri, []);
        width = probe.width ?? undefined;
        height = probe.height ?? undefined;
      } catch {}
      thumbUri = (await makeThumb(a.uri)) ?? undefined;
    }
    // Bytes go straight from disk to R2 via a presigned URL, no Blob, no
    // base64 round-trip through Hermes. The edge `media` function owns the
    // `media_assets` insert/status; the device never inserts the row itself.
    const res = await uploadMediaFromFile(wsId, a.uri, { kind, width, height, thumbUri });
    linked.push(res.mediaId);
    newPaths.push(res.storagePath);
    if (thumbUri) {
      FileSystem.deleteAsync(thumbUri, { idempotent: true }).catch(() => {});
    }
  }

  // Links BEFORE targets (atomicity): the worker only ever sees queued
  // targets, so a target must never exist while its media links are still
  // the previous push's rows, that window published the old video.
  // Remember the previous links first so stale objects/rows can be swept
  // after the new ones land (best-effort, never fails the push).
  let prevPaths: string[] = [];
  let prevIds: string[] = [];
  let prevKnown = false;
  try {
    const { data: prev } = await sb
      .from('post_media')
      .select('media_id, media_assets!inner(storage_path)')
      .eq('post_id', postId);
    prevIds = ((prev ?? []) as any[])
      .map((r) => String((r as any)?.media_id ?? ''))
      .filter(Boolean);
    prevPaths = ((prev ?? []) as any[])
      .map((r) => String((r as any)?.media_assets?.storage_path ?? ''))
      .filter(Boolean);
    prevKnown = true;
  } catch {}
  // No attachments at all means the draft's media never reached this device
  // (or the composer cleared it). Preserve the cloud links in the first case
  // instead of erasing media the user can still see on the web. If the query
  // itself failed we also keep them: never delete on unknown state.
  const keepExisting =
    atts.length === 0 && !post.mediaCleared && (!prevKnown || prevIds.length > 0);
  if (!keepExisting) {
    await sb.from('post_media').delete().eq('post_id', postId);
    for (let i = 0; i < linked.length; i++) {
      const { error: linkErr } = await sb
        .from('post_media')
        .insert({ post_id: postId, media_id: linked[i], position: i });
      if (linkErr) throw new Error(`cloud media link failed: ${linkErr.message}`);
    }
  }

  // Targets: one per (platform × account) that is BOTH selected AND
  // cloud-connected. Platforms with no cloud row stay local-only (correct -
  // nothing to publish with). The (post_id, channel_id) upsert converges on
  // re-push, so re-saving never duplicates targets.
  let made = 0;
  for (const platform of post.platforms ?? []) {
    for (const acct of accountsFor(platform)) {
      const ext = accountExternalId(acct);
      const channelId = ext ? byKey.get(`${platform}:${ext}`) : byProvider.get(platform);
      if (!channelId) continue;
      const options: Record<string, unknown> = {};
      if (post.threadsTopic) options.threadsTopic = post.threadsTopic;
      if (post.ttPrivacy) options.ttPrivacy = post.ttPrivacy;
      if (post.ytPrivacy) options.ytPrivacy = post.ytPrivacy;
      if (post.sourceUrl) options.sourceUrl = post.sourceUrl;
      // Chain segments ride on the target so the worker can replay the exact same
      // thread the app would have posted (local publisher is source of truth).
      if (isChainPlatform(platform) && post.thread && post.thread.length > 1) {
        const segs = post.thread.map((s) => (s ?? '').trim()).filter(Boolean);
        if (segs.length > 1) options.thread = segs;
      }
      const format = (post.platformTypes as any)?.[platform];
      // idempotency_key is NOT NULL with no default, deterministic so
      // retries and re-saves converge instead of violating.
      const { error: tErr } = await sb.from('post_targets').upsert(
        {
          post_id: postId,
          channel_id: channelId,
          provider: platform,
          format: typeof format === 'string' ? format : null,
          caption: post.body ?? '',
          options,
          status: targetStatus,
          scheduled_at: scheduledIso,
          idempotency_key: `cloud:${post.id}:${channelId}`,
        },
        { onConflict: 'post_id,channel_id' },
      );
      if (tErr) throw new Error(`cloud target upsert failed (${platform}): ${tErr.message}`);
      made += 1;
    }
  }

  // Sweep superseded objects/rows from earlier pushes of THIS post only
  // (best-effort, a leftover media object in this prefix is exactly how a
  // replaced video haunted the next publish). New uploads live in R2, so the
  // edge `delete` action removes the object + marks the row deleted.
  try {
    // Reused cloud media has no new storage path to compare against; sweeping
    // here would delete the very objects we just re-linked. Same when we kept
    // the existing links because this device had no local copies.
    const stale = reusedCloudMedia || keepExisting
      ? []
      : prevPaths.filter((p) => p && !newPaths.includes(p));
    if (stale.length) {
      const { data: rows } = await sb
        .from('media_assets')
        .select('id, storage_path')
        .eq('workspace_id', wsId)
        .in('storage_path', stale);
      const ids = ((rows ?? []) as any[]).map((r) => String(r.id)).filter(Boolean);
      for (const id of ids) {
        await callEdgeFunction('media', { action: 'delete', mediaId: id }).catch(() => {});
      }
    }
  } catch {}
  // Record the successful push, the pull uses this allowlist to retract
  // rows the web deleted (never-pushed local drafts are untouchable). A
  // successful push also clears any stale delete tombstone for this id.
  await markPushed(post.id);
  await unmarkDeleted(post.id);
  console.log(
    `[cloud] pushed ${post.id}: ${made} target(s), ${linked.length} media for [${(post.platforms ?? []).join(',')}]`,
  );
}

/**
 * Mark one mirrored leg sent (light PATCH, no media re-upload). Called when a
 * LOCAL leg lands so the worker won't republish that channel if the app dies
 * mid-queue. Never throws.
 */
export async function markCloudLegSent(clientId: string, provider: string, remoteId: string): Promise<void> {
  try {
    const session = await currentSession().catch(() => null);
    if (!session) return;
    const sb = supabase();
    const { data: prow } = await sb.from('posts').select('id').eq('client_id', clientId).maybeSingle();
    const pid = (prow as any)?.id;
    if (!pid) return;
    await sb
      .from('post_targets')
      .update({ status: 'sent', remote_id: remoteId })
      .eq('post_id', pid)
      .eq('provider', provider);
  } catch {}
}

/**
 * Mark the mirrored post sent (light PATCH). The full push upserts every
 * target row, so flipping via push would clobber per-leg worker verdicts.
 * Never throws.
 */
export async function markCloudPostSent(clientId: string): Promise<void> {
  try {
    const session = await currentSession().catch(() => null);
    if (!session) return;
    await supabase().from('posts').update({ status: 'sent' }).eq('client_id', clientId);
  } catch {}
}

/** Delete the cloud mirror (cascade clears targets + links; bytes fall to the worker janitor). */
export async function deleteCloudPost(clientId: string): Promise<void> {
  // Tombstone BEFORE the session check: deleting while signed out must still
  // keep the mirror from resurrecting as a "web post" on the next pull.
  await markDeleted(clientId);
  const session = await currentSession().catch(() => null);
  if (!session) return;
  const sb = supabase();
  const { data: prow } = await sb.from('posts').select('id').eq('client_id', clientId).maybeSingle();
  const id = (prow as any)?.id;
  if (!id) {
    // Nothing left in the cloud: the tombstone has done its job.
    await unmarkDeleted(clientId);
    await unmarkPushed(clientId);
    return;
  }
  const { error } = await sb.from('posts').delete().eq('id', id);
  if (error) throw new Error(`cloud post delete failed: ${error.message}`);
  await unmarkDeleted(clientId);
  await unmarkPushed(clientId);
}

/**
 * Back-sync (the reason pull-to-refresh exists): cloud is the publishing
 * authority, so local Queued flips to Sent only when EVERY cloud target for
 * the post reached sent, collecting remote_ids for the Sent view.
 * Anything else (pending/failed targets) stays queued. Never throws.
 */
export async function pullCloudStatus(): Promise<{ updated: number }> {
  try {
    const session = await currentSession().catch(() => null);
    if (!session) return { updated: 0 };
    const localWs = await activeWorkspaceId();
    const locals = (await loadManagedPosts()).filter((p) => p.status === 'queued');
    if (!locals.length) return { updated: 0 };
    const sb = supabase();
    const { data: cposts } = await sb
      .from('posts')
      .select('id, client_id, status')
      .in(
        'client_id',
        locals.map((p) => p.id),
      );
    const cloudByClient = new Map(
      (((cposts ?? []) as any[]) as { client_id: string; id: string; status: string }[]).map((r) => [
        String(r.client_id),
        { id: String(r.id), status: String(r.status) },
      ]),
    );
    const cloudIds = [...cloudByClient.values()].map((r) => r.id);
    if (!cloudIds.length) return { updated: 0 };
    const { data: tgts } = await sb
      .from('post_targets')
      .select('post_id, provider, status, remote_id, last_error')
      .in('post_id', cloudIds);
    const byPost = new Map<string, any[]>();
    for (const t of ((tgts ?? []) as any[])) {
      const arr = byPost.get(String(t.post_id)) ?? [];
      arr.push(t);
      byPost.set(String(t.post_id), arr);
    }
    let updated = 0;
    for (const p of locals) {
      if (await workspaceMoved(localWs)) return { updated: 0 };
      const cloud = cloudByClient.get(p.id);
      if (!cloud) continue;
      const rows = byPost.get(cloud.id) ?? [];
      // Failures must land in the Failed tab on the same 5-min tick, not only
      // when a full pull happens (opening Home/Post throttles that one).
      if (cloud.status === 'failed' || cloud.status === 'partial') {
        if (p.status === 'failed') continue;
        const channelErr: Record<string, string> = {};
        const remoteIds: Record<string, string> = { ...(p.remoteIds ?? {}) };
        for (const r of rows) {
          if (String(r.status) === 'failed') {
            channelErr[String(r.provider)] = String(r.last_error || 'Publishing failed.');
          }
          if (r.remote_id) remoteIds[String(r.provider)] = String(r.remote_id);
        }
        await saveManagedPostLocal({
          ...p,
          status: 'failed',
          sentAt: Date.now(),
          remoteIds,
          ...(Object.keys(channelErr).length ? { channelErr } : {}),
        });
        updated += 1;
        continue;
      }
      if (!rows.length || !rows.every((r) => String(r.status) === 'sent')) continue;
      const remoteIds: Record<string, string> = { ...(p.remoteIds ?? {}) };
      for (const r of rows) {
        if (r.remote_id) remoteIds[String(r.provider)] = String(r.remote_id);
      }
      // Local save + LIGHT cloud PATCH only: saveManagedPost here would
      // re-upload every attachment on every status flip (sent-flips arrive
      // per sweep), which burned egress forever. The verdict already lives
      // in the cloud, the posts.status patch is all the mirror needs.
      await saveManagedPostLocal({ ...p, status: 'sent', sentAt: Date.now(), remoteIds });
      await markCloudPostSent(p.id);
      updated += 1;
    }
    if (updated > 0) console.log(`[cloud] back-sync: ${updated} verdict(s)`);
    return { updated };
  } catch {
    return { updated: 0 };
  }
}

/* ---------------- Cloud → device post pull ---------------- */

/** Cloud post UUIDs already adopted as local rows (web posts have no client_id). */
const ADOPTED_KEY = 'sosial_cloud_adopted_posts_v1';

/** client_id → timestamp of last successful push (retraction allowlist). */
const PUSHED_KEY = 'sosial_cloud_pushed_posts_v1';

/** Allowlists are per workspace: one team's ids must never retract another's. */
async function storeKey(base: string): Promise<string> {
  return scopedKey(base, await activeWorkspaceId());
}

/** True when the device was re-pinned (team switch) while a sync was running:
 *  the rest of that pass must not write into the newly active team's store. */
async function workspaceMoved(ws: string | null): Promise<boolean> {
  return (await activeWorkspaceId()) !== ws;
}

async function loadPushed(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(await storeKey(PUSHED_KEY));
    const obj: unknown = raw ? JSON.parse(raw) : {};
    if (obj && typeof obj === 'object') {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (typeof v === 'number') out[k] = v;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

async function markPushed(clientId: string): Promise<void> {
  try {
    const cur = await loadPushed();
    cur[clientId] = Date.now();
    const keys = Object.keys(cur);
    const trimmed: Record<string, number> = {};
    for (const k of keys.slice(-500)) trimmed[k] = cur[k];
    await AsyncStorage.setItem(await storeKey(PUSHED_KEY), JSON.stringify(trimmed));
  } catch {}
}

async function unmarkPushed(clientId: string): Promise<void> {
  try {
    const cur = await loadPushed();
    if (clientId in cur) {
      delete cur[clientId];
      await AsyncStorage.setItem(await storeKey(PUSHED_KEY), JSON.stringify(cur));
    }
  } catch {}
}

/**
 * client_id → timestamp of a local delete whose cloud mirror may still exist.
 * A delete while signed out (or a failed cloud delete) otherwise erases the
 * `pushed` memory, and the next pull re-adopts the surviving cloud row as a
 * brand-new "web post". The pull honours these and clears them once the cloud
 * row is confirmed gone.
 */
const DELETED_KEY = 'sosial_cloud_deleted_posts_v1';

async function loadDeleted(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(await storeKey(DELETED_KEY));
    const obj: unknown = raw ? JSON.parse(raw) : {};
    if (obj && typeof obj === 'object') {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (typeof v === 'number') out[k] = v;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

async function markDeleted(clientId: string): Promise<void> {
  if (!clientId) return;
  try {
    const cur = await loadDeleted();
    cur[clientId] = Date.now();
    const trimmed: Record<string, number> = {};
    for (const k of Object.keys(cur).slice(-500)) trimmed[k] = cur[k];
    await AsyncStorage.setItem(await storeKey(DELETED_KEY), JSON.stringify(trimmed));
  } catch {}
}

async function unmarkDeleted(clientId: string): Promise<void> {
  try {
    const cur = await loadDeleted();
    if (clientId in cur) {
      delete cur[clientId];
      await AsyncStorage.setItem(await storeKey(DELETED_KEY), JSON.stringify(cur));
    }
  } catch {}
}

/**
 * Push every local post that never reached the cloud (saved offline,
 * signed-out, or written by a local-only path). This is the other half of
 * web/mobile parity: without it the phone keeps rows the web never sees.
 * Best-effort per row, one failure must not block the rest. Never throws.
 */
export async function pushPendingPosts(): Promise<number> {
  try {
    const session = await currentSession().catch(() => null);
    if (!session) return 0;
    const localWs = await activeWorkspaceId();
    const [locals, pushed] = await Promise.all([
      loadManagedPosts().catch(() => []),
      loadPushed(),
    ]);
    let n = 0;
    for (const p of locals) {
      if (await workspaceMoved(localWs)) break;
      // Adopted web rows are already in the cloud (and re-pushing a failed
      // one would reset its targets to pending). Only explicit saves mirror
      // those; the backlog pass owns phone-created rows.
      if (!p?.id || p.id.startsWith('cloud_')) continue;
      if (pushed[p.id]) continue;
      try {
        await pushPostToCloud(p);
        n += 1;
      } catch {
        /* next save or sweep retries */
      }
    }
    return n;
  } catch {
    return 0;
  }
}

async function loadAdopted(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(await storeKey(ADOPTED_KEY));
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

async function markAdopted(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    const cur = await loadAdopted();
    for (const id of ids) cur.add(id);
    await AsyncStorage.setItem(await storeKey(ADOPTED_KEY), JSON.stringify([...cur].slice(-500)));
  } catch {}
}

function cloudStatusToLocal(s: string): ManagedPost['status'] {
  if (s === 'sent') return 'sent';
  if (s === 'failed' || s === 'partial') return 'failed';
  if (s === 'approval') return 'approval';
  if (s === 'draft') return 'draft';
  return 'queued';
}

/** Publishing-authority statuses: the cloud verdict always wins locally. */
function isAuthoritative(s: string): boolean {
  return s === 'sent' || s === 'failed' || s === 'partial' || s === 'publishing';
}

function absUrl(signed: string): string {
  if (signed.startsWith('http')) return signed;
  return `${supabaseUrl()}/storage/v1${signed.startsWith('/') ? '' : '/'}${signed}`;
}

const VIDEO_PULL_CAP = 25 * 1024 * 1024;

/**
 * Content fingerprint of a cloud post (text + media asset ids). Identical sig
 * = identical post: the pull keeps local attachments instead of re-downloading
 * every video/image on each sweep (timestamps bump without content changes).
 */
function cloudSigOf(cp: CloudPostRow, media: CloudMediaRow[], tgts: CloudTargetRow[]): string {
  const mediaPart = media
    .map((m) => `${m.media_assets?.id ?? ''}:${m.media_assets?.storage_path ?? ''}`)
    .join(',');
  const tgtPart = tgts
    .map((t) => `${t.provider}:${t.format ?? ''}:${t.options ? JSON.stringify(t.options) : ''}`)
    .join('|');
  return `${cp.title ?? ''}¦${cp.body ?? ''}¦${cp.status}¦${cp.scheduled_at ?? ''}¦${mediaPart}¦${tgtPart}`;
}

/**
 * Best-effort: resolve one cloud asset for the composer. Keeps the media row
 * id either way, so saving an edit links the existing asset instead of
 * re-uploading (or losing it when the bytes never landed on this device).
 * Videos over the pull cap and failed downloads fall back to the signed URL.
 * If even signing fails we keep a placeholder carrying the id, so the edit
 * still links the asset instead of silently dropping it.
 */
async function fetchAsset(
  sb: ReturnType<typeof supabase>,
  assetId: string,
  storagePath: string,
  kind: 'image' | 'video',
  hint: string,
  byteSize: number | null,
  backend: string | null,
): Promise<MediaAttachment> {
  const size = typeof byteSize === 'number' ? byteSize : undefined;
  const placeholder: MediaAttachment = { uri: '', kind, mediaId: assetId, size };
  try {
    // New media lives in R2 (storage_backend='r2') and Supabase Storage
    // cannot sign it. Ask the media edge function for the presigned URL
    // (same path the web bell uses), and fall back to Storage for legacy rows.
    let url: string | null = null;
    if (backend === 'r2') {
      try {
        const res = await callEdgeFunction('media', {
          action: 'sign',
          items: [{ path: storagePath, bucket: 'post-media' }],
          expiresIn: 600,
        });
        const u = (res as { urls?: string[] } | null)?.urls?.[0];
        if (u) url = u;
      } catch {}
    }
    if (!url) {
      const { data, error } = await sb.storage.from('post-media').createSignedUrl(storagePath, 600);
      if (error || !data?.signedUrl) return placeholder;
      url = absUrl(data.signedUrl);
    }
    const remote: MediaAttachment = { uri: url, kind, mediaId: assetId, size };
    if (kind === 'video' && typeof byteSize === 'number' && byteSize > VIDEO_PULL_CAP) {
      // Stream the preview, keep the cloud row, skip the multi-MB download.
      return remote;
    }
    const dir = `${FileSystem.documentDirectory}sync/`;
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch {}
    const ext = (storagePath.split('.').pop() ?? (kind === 'video' ? 'mp4' : 'jpg')).slice(0, 4);
    const dest = `${dir}${hint}.${ext}`;
    try {
      const dl = await FileSystem.downloadAsync(url, dest);
      if (dl.status === 200) return { uri: dl.uri, kind, mediaId: assetId, size };
    } catch {}
    return remote;
  } catch {
    return placeholder;
  }
}

export interface PullPostsResult {
  /** web-created posts adopted as new local rows */
  adopted: number;
  /** existing local rows updated from the cloud */
  updated: number;
  /** local rows removed because the web deleted them */
  removed: number;
}

interface CloudPostRow {
  id: string;
  client_id: string | null;
  title: string | null;
  body: string | null;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  timezone: string | null;
  updated_at: string | null;
}

interface CloudTargetRow {
  post_id: string;
  provider: string;
  status: string;
  format: string | null;
  caption: string | null;
  options: Record<string, unknown> | null;
  remote_id: string | null;
  last_error: string | null;
}

interface CloudMediaRow {
  post_id: string;
  position: number;
  media_assets: {
    id: string;
    storage_path: string;
    kind: string;
    byte_size: number | null;
    storage_backend: string | null;
  } | null;
}

/**
 * Cloud → device post pull: the missing half of post sync. Adopts posts
 * created on the web (tracked by cloud UUID so each is adopted once) and
 * reconciles existing rows, publishing verdicts (sent/failed/…) always win,
 * everything else is last-write-wins by updated_at. Media downloads
 * best-effort (videos over 25 MB stay cloud-only). Never throws.
 */
export async function pullCloudPosts(): Promise<PullPostsResult> {
  const out: PullPostsResult = { adopted: 0, updated: 0, removed: 0 };
  try {
    const session = await currentSession().catch(() => null);
    if (!session) return out;
    const sb = supabase();
    const wsId = session.workspace.id;
    const localWs = await activeWorkspaceId();

    const { data: posts, error } = await sb
      .from('posts')
      .select('id, client_id, title, body, status, scheduled_at, sent_at, timezone, updated_at')
      .eq('workspace_id', wsId)
      .order('updated_at', { ascending: false })
      .limit(500);
    if (error || !posts?.length) return out;
    const rows = posts as CloudPostRow[];
    const ids = rows.map((p) => p.id);

    const [{ data: targets }, { data: links }] = await Promise.all([
      sb
        .from('post_targets')
        .select('post_id, provider, status, format, caption, options, remote_id, last_error')
        .in('post_id', ids),
      sb
        .from('post_media')
        .select('post_id, position, media_assets!inner(id, storage_path, kind, byte_size, storage_backend)')
        .in('post_id', ids)
        .order('position'),
    ]);
    const targetsByPost = new Map<string, CloudTargetRow[]>();
    for (const t of ((targets ?? []) as CloudTargetRow[])) {
      const arr = targetsByPost.get(t.post_id) ?? [];
      arr.push(t);
      targetsByPost.set(t.post_id, arr);
    }
    const mediaByPost = new Map<string, CloudMediaRow[]>();
    for (const m of ((links ?? []) as unknown as Record<string, unknown>[])) {
      const assets = (m as { media_assets?: unknown }).media_assets;
      const asset = Array.isArray(assets) ? assets[0] : assets;
      const row: CloudMediaRow = {
        post_id: String((m as { post_id?: unknown }).post_id ?? ''),
        position: Number((m as { position?: unknown }).position) || 0,
        media_assets: (asset && typeof asset === 'object'
          ? (asset as CloudMediaRow['media_assets'])
          : null) as CloudMediaRow['media_assets'],
      };
      if (!row.post_id || !row.media_assets) continue;
      const arr = mediaByPost.get(row.post_id) ?? [];
      arr.push(row);
      mediaByPost.set(row.post_id, arr);
    }

    const locals = await loadManagedPosts();
    const byClient = new Map(locals.map((p) => [p.id, p]));
    const adopted = await loadAdopted();
    const deleted = await loadDeleted();
    const newlyAdopted: string[] = [];

    /** Per-provider failure notes from the cloud targets (failed legs only). */
    const errorsOf = (rows: CloudTargetRow[]): Record<string, string> => {
      const map: Record<string, string> = {};
      for (const t of rows) {
        if (t.status === 'failed') map[t.provider] = t.last_error || 'Publishing failed.';
      }
      return map;
    };

    const buildAttachments = async (postId: string, hint: string): Promise<MediaAttachment[] | null> => {
      const media = (mediaByPost.get(postId) ?? []).filter((m) => Boolean(m.media_assets));
      if (!media.length) return null;
      const picked = media.slice(0, 10).map((m, i) => ({ asset: m.media_assets!, i }));
      const got = await Promise.all(
        picked.map(({ asset, i }) => {
          const kind = asset.kind === 'video' ? 'video' : 'image';
          return fetchAsset(sb, asset.id, asset.storage_path, kind, `${hint}_${i}`, asset.byte_size, asset.storage_backend);
        }),
      );
      const atts = got.filter((a): a is MediaAttachment => !!a);
      return atts.length ? atts : null;
    };

    for (const cp of rows) {
      // Deleted on this device but the cloud mirror survived (offline or
      // signed-out delete): kill it here and never re-adopt it locally.
      if (cp.client_id && deleted[String(cp.client_id)] !== undefined) {
        const cid = String(cp.client_id);
        try {
          await sb.from('posts').delete().eq('id', cp.id);
        } catch {}
        await unmarkDeleted(cid);
        await unmarkPushed(cid);
        if (byClient.has(cid)) {
          await deleteManagedPost(cid).catch(() => null);
          byClient.delete(cid);
          out.removed += 1;
        }
        continue;
      }
      const cloudTs = (cp.updated_at && Date.parse(cp.updated_at)) || 0;
      const tgts = targetsByPost.get(cp.id) ?? [];
      const platforms = [...new Set(tgts.map((t) => String(t.provider)).filter(Boolean))];
      const scheduledMs = cp.scheduled_at ? Date.parse(cp.scheduled_at) : NaN;

      const existing = cp.client_id ? byClient.get(String(cp.client_id)) : undefined;
      if (existing) {
        const localTs = existing.updatedAt ?? existing.createdAt ?? 0;
        let next: ManagedPost | null = null;
        if (isAuthoritative(cp.status)) {
          // Publishing verdicts (web parity): sent wins; failed/partial land
          // in the Failed tab instead of haunting the Queue.
          const want: ManagedPost['status'] =
            cp.status === 'sent' ? 'sent'
            : cp.status === 'failed' || cp.status === 'partial' ? 'failed'
            : 'queued';
          const remoteIds: Record<string, string> = { ...(existing.remoteIds ?? {}) };
          for (const t of tgts) {
            if (t.remote_id) remoteIds[String(t.provider)] = String(t.remote_id);
          }
          const channelErr = errorsOf(tgts);
          const sentAt =
            want === 'sent'
              ? (cp.sent_at ? Date.parse(cp.sent_at) || Date.now() : existing.sentAt ?? Date.now())
              : existing.sentAt;
          if (
            existing.status !== want ||
            existing.sentAt !== sentAt ||
            JSON.stringify(existing.remoteIds ?? {}) !== JSON.stringify(remoteIds) ||
            JSON.stringify(existing.channelErr ?? {}) !== JSON.stringify(channelErr)
          ) {
            next = {
              ...existing,
              status: want,
              remoteIds,
              channelErr,
              sentAt,
            };
          }
        } else if (cloudTs > localTs) {
          // Same fingerprint = nothing actually changed (updated_at bumps on
          // unrelated writes). Keep local attachments; skip the re-download.
          const media = mediaByPost.get(cp.id) ?? [];
          const sig = cloudSigOf(cp, media, tgts);
          if (existing.cloudSig && existing.cloudSig === sig) {
            continue;
          }
          const atts = await buildAttachments(cp.id, cp.client_id ?? cp.id);
          const platformTypes: Record<string, string> = { ...(existing.platformTypes ?? {}) };
          for (const t of tgts) {
            if (t.format) (platformTypes as Record<string, unknown>)[t.provider] = t.format;
          }
          const threadTgt = tgts.find(
            (t) => t.options && Array.isArray((t.options as Record<string, unknown>).thread),
          );
          next = {
            ...existing,
            title: cp.title ?? existing.title,
            body: cp.body ?? existing.body,
            status: cloudStatusToLocal(cp.status),
            scheduledAt: Number.isFinite(scheduledMs) ? scheduledMs : undefined,
            timezone: cp.timezone ?? existing.timezone,
            platforms: platforms.length ? platforms : existing.platforms,
            platformTypes: Object.keys(platformTypes).length
              ? (platformTypes as ManagedPost['platformTypes'])
              : existing.platformTypes,
            thread:
              (threadTgt?.options as { thread?: string[] } | null)?.thread ??
              existing.thread,
            cloudSig: sig,
            ...(atts ? { attachments: atts, imageUri: undefined, videoUri: undefined } : {}),
          };
        }
        if (next) {
          if (await workspaceMoved(localWs)) return out;
          await saveManagedPostLocal(next);
          byClient.set(next.id, next);
          out.updated += 1;
        }
        continue;
      }

      // Web-created row: adopt once, then it syncs like any local post.
      // Claim the cloud row by client_id (owner/admin can) so the next
      // mobile save upserts the SAME row instead of duplicating it.
      if (adopted.has(cp.id)) continue;
      const hint = `web_${cp.id.slice(0, 8)}`;
      const media = mediaByPost.get(cp.id) ?? [];
      const atts = await buildAttachments(cp.id, hint);
      const platformTypes: Record<string, string> = {};
      for (const t of tgts) {
        if (t.format) platformTypes[t.provider] = t.format;
      }
      const threadTgt = tgts.find(
        (t) => t.options && Array.isArray((t.options as Record<string, unknown>).thread),
      );
      const remoteIds: Record<string, string> = {};
      for (const t of tgts) {
        if (t.remote_id) remoteIds[t.provider] = t.remote_id;
      }
      const status = cloudStatusToLocal(cp.status);
      // Keep the cloud's client_id when it already has one (another phone or
      // a previously claimed row): the local id must match it, otherwise the
      // next save here would create a duplicate cloud post and the original
      // device would adopt the same row again under yet another id.
      const localId = cp.client_id ? String(cp.client_id) : `cloud_${cp.id.slice(0, 12)}`;
      const rec: ManagedPost = {
        id: localId,
        title: cp.title ?? '',
        body: tgts[0]?.caption ?? cp.body ?? '',
        platforms,
        platformTypes: Object.keys(platformTypes).length
          ? (platformTypes as ManagedPost['platformTypes'])
          : undefined,
        thread: (threadTgt?.options as { thread?: string[] } | null)?.thread,
        scheduledAt: Number.isFinite(scheduledMs) ? scheduledMs : undefined,
        timezone: cp.timezone ?? undefined,
        createdAt: cloudTs || Date.now(),
        updatedAt: cloudTs || Date.now(),
        status,
        sentAt: status === 'sent' ? (cp.sent_at ? Date.parse(cp.sent_at) || cloudTs : cloudTs) : undefined,
        remoteIds: Object.keys(remoteIds).length ? remoteIds : undefined,
        channelErr: Object.keys(errorsOf(tgts)).length ? errorsOf(tgts) : undefined,
        cloudSig: cloudSigOf(cp, media, tgts),
        attachments: atts ?? undefined,
      };
      if (await workspaceMoved(localWs)) return out;
      await saveManagedPostLocal(rec);
      byClient.set(rec.id, rec);
      if (!cp.client_id) {
        try {
          // Claiming client_id lets this device upsert the SAME cloud row on
          // later saves. Non-creators (teammates) cannot, and RLS answers
          // with zero rows, so only a claimed row joins the push allowlist.
          const { data: claimedRows, error: claimErr } = await sb
            .from('posts')
            .update({ client_id: rec.id })
            .eq('id', cp.id)
            .select('id');
          if (!claimErr && claimedRows && claimedRows.length > 0) {
            await markPushed(rec.id);
          }
        } catch {}
      } else {
        // Already owned by a client id: remember it so the backlog pass does
        // not re-upload the same media, and the delete retraction can fire.
        await markPushed(rec.id);
      }
      newlyAdopted.push(cp.id);
      out.adopted += 1;
    }

    if (await workspaceMoved(localWs)) return out;
    await markAdopted(newlyAdopted);

    // Retraction: a pushed row the web deleted disappears locally too, but
    // only with no newer local edits, and never for never-pushed drafts or
    // adopted-but-unclaimed rows (their client_id isn't in the cloud list).
    // The id/client_id scan is deliberately LIMIT-free: the 500-row content
    // page above must never make an older local row look "deleted".
    const { data: allRows } = await sb.from('posts').select('id, client_id').eq('workspace_id', wsId);
    const all = (allRows ?? []) as { id: string; client_id: string | null }[];
    const cloudClients = new Set(
      all.map((p) => (p.client_id ? String(p.client_id) : '')).filter(Boolean),
    );
    const cloudAdoptedIds = new Set(all.map((p) => `cloud_${String(p.id).slice(0, 12)}`));
    const pushed = await loadPushed();
    for (const [cid, pushedTs] of Object.entries(pushed)) {
      if (await workspaceMoved(localWs)) break;
      if (!cid || cloudClients.has(cid) || adopted.has(cid)) continue;
      const local = byClient.get(cid);
      if (!local) {
        await unmarkPushed(cid);
        continue;
      }
      const localTs = local.updatedAt ?? local.createdAt ?? 0;
      if (localTs <= pushedTs) {
        await deleteManagedPost(cid).catch(() => null);
        byClient.delete(cid);
        out.removed += 1;
      }
    }

    // Teammate posts cannot be claimed (RLS: only creator/admin), so their
    // local ids never join `pushed`. Match them by the deterministic adopted
    // id instead: absent from the full cloud scan means the web deleted it.
    for (const local of [...byClient.values()]) {
      if (await workspaceMoved(localWs)) break;
      if (!local.id.startsWith('cloud_') || cloudAdoptedIds.has(local.id)) continue;
      const pushedTs = pushed[local.id];
      const localTs = local.updatedAt ?? local.createdAt ?? 0;
      if (pushedTs !== undefined && localTs > pushedTs) continue;
      await deleteManagedPost(local.id).catch(() => null);
      byClient.delete(local.id);
      out.removed += 1;
    }

    // Drop tombstones whose cloud row no longer exists at all.
    for (const cid of Object.keys(deleted)) {
      if (await workspaceMoved(localWs)) break;
      if (!cloudClients.has(cid)) await unmarkDeleted(cid);
    }

    if (out.adopted + out.updated + out.removed > 0) {
      console.log(`[cloud] pull posts: ${out.adopted} adopted, ${out.updated} updated, ${out.removed} removed`);
    }
    return out;
  } catch {
    return out;
  }
}

let lastPullAt = 0;
let pulling: Promise<PullPostsResult> | null = null;

/**
 * Single-flight, throttled pull. The app shell and the composer sweep both
 * ask for post sync (launch, foreground, tab switch); this guarantees one
 * run at a time and skips redundant passes, which is what made launch feel
 * slow (two concurrent pulls downloading the same media).
 */
export async function requestCloudPostSync(maxAgeMs = 20000): Promise<PullPostsResult> {
  if (pulling) return pulling;
  if (Date.now() - lastPullAt < maxAgeMs) {
    return { adopted: 0, updated: 0, removed: 0 };
  }
  pulling = pullCloudPosts().finally(() => {
    pulling = null;
    lastPullAt = Date.now();
  });
  return pulling;
}
