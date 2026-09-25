import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseUrl, currentSession } from './supabase';
import { loadManagedPosts, saveManagedPost, saveManagedPostLocal, deleteManagedPost, postAttachments, type ManagedPost, type MediaAttachment } from './managed';
import { isChainPlatform } from './thread';
import { loadAccounts } from './metaStore';
import { findAccount, findAccountForProvider, accountExternalId, asIdList, type ConnectedAccount, type ProviderKey } from './socialAccounts';

/**
 * App → cloud write path (post-Wave-A slice). Every local save/delete
 * mirrors to Supabase best-effort: the device is source of truth, the cloud
 * is a follower. Never throws — callers fire-and-forget after local write.
 *
 * Identity: posts.client_id = local ManagedPost.id (P3 unique key), so
 * re-saves upsert instead of duplicating. Media uses deterministic storage
 * paths (<workspace>/<client_id>/<index>.<ext>), uploaded natively.
 */

function extFor(uri: string, kind: string): string {
  const u = uri.toLowerCase().split('?')[0];
  const m = u.match(/\.([a-z0-9]{2,4})$/);
  if (m) return m[1];
  return kind === 'video' ? 'mp4' : 'jpg';
}

function mimeFor(ext: string, kind: string): string {
  if (kind === 'video') {
    if (ext === 'mov') return 'video/quicktime';
    return 'video/mp4';
  }
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

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
 * Target-level twin of mapStatus. post_targets has no 'draft'/'approval' —
 * those are 'pending'/'needs_approval' per leg — so reusing the post status
 * violates post_targets_status_check and the whole push fails loudly.
 */
function mapTargetStatus(p: ManagedPost): 'pending' | 'needs_approval' | CloudStatus {
  const s = mapStatus(p);
  if (s === 'draft') return 'pending';
  if (s === 'approval') return 'needs_approval';
  return s;
}

/** Mirror one local post (idempotent by client_id). Resolves when done. */
export async function pushPostToCloud(post: ManagedPost): Promise<void> {
  const session = await currentSession().catch(() => null);
  if (!session) {
    console.log('[cloud] skip push — signed out');
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

  // Post row (upsert on client_id — the P3 idempotency key).
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
        timezone: deviceTimezone(),
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
  // never publish a half-built (e.g. text-only) post — the failure stays
  // loud in Metro instead of masquerading as success.

  // Media: canonical accessor only — `attachments` already contains EVERY
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
  const pushStamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  for (const a of atts) {
    if (!a?.uri || linked.length >= 10) continue;
    const kind = a.kind === 'video' ? 'video' : 'image';
    const ext = extFor(a.uri, kind);
    const mime = mimeFor(ext, kind);
    const path = `${wsId}/${post.id}/${linked.length}-${pushStamp}.${ext}`;
    // Native binary upload: Hermes cannot build Blobs from TypedArrays, so
    // the file goes straight from disk via a signed upload slot — no JS
    // Blob, no base64 round-trip through JS memory.
    const { data: slot, error: slotErr } = await sb.storage.from('post-media').createSignedUploadUrl(path);
    if (slotErr || !slot?.signedUrl) {
      throw new Error(`cloud media upload slot failed: ${slotErr?.message ?? 'no url'}`);
    }
    const signed = slot.signedUrl.startsWith('http')
      ? slot.signedUrl
      : `${supabaseUrl()}/storage/v1${slot.signedUrl.startsWith('/') ? '' : '/'}${slot.signedUrl}`;
    const up = await FileSystem.uploadAsync(signed, a.uri, {
      httpMethod: 'PUT',
      headers: { 'Content-Type': mime },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });
    if (up.status < 200 || up.status >= 300) {
      throw new Error(`cloud media upload failed (${up.status})`);
    }
    let byteSize: number | null = null;
    try {
      const info: any = await FileSystem.getInfoAsync(a.uri);
      if (info?.exists && typeof info.size === 'number' && info.size > 0) byteSize = info.size;
    } catch {}
    // Unique paths never collide, so always insert a fresh asset row — the
    // old path-keyed dedupe reused the previous video's row after a swap.
    const { data: ins, error: mErr } = await sb
      .from('media_assets')
      .insert({
        workspace_id: wsId,
        uploaded_by: userId,
        storage_path: path,
        kind,
        mime_type: mime,
        byte_size: byteSize,
        status: 'ready',
      })
      .select('id')
      .single();
    if (mErr || !ins) throw new Error(`cloud media row failed: ${mErr?.message ?? 'no row'}`);
    linked.push(String((ins as any).id));
    newPaths.push(path);
  }

  // Links BEFORE targets (atomicity): the worker only ever sees queued
  // targets, so a target must never exist while its media links are still
  // the previous push's rows — that window published the old video.
  // Remember the previous links first so stale objects/rows can be swept
  // after the new ones land (best-effort — never fails the push).
  let prevPaths: string[] = [];
  try {
    const { data: prev } = await sb
      .from('post_media')
      .select('media_id, media_assets!inner(storage_path)')
      .eq('post_id', postId);
    prevPaths = ((prev ?? []) as any[])
      .map((r) => String((r as any)?.media_assets?.storage_path ?? ''))
      .filter(Boolean);
  } catch {}
  await sb.from('post_media').delete().eq('post_id', postId);
  for (let i = 0; i < linked.length; i++) {
    const { error: linkErr } = await sb
      .from('post_media')
      .insert({ post_id: postId, media_id: linked[i], position: i });
    if (linkErr) throw new Error(`cloud media link failed: ${linkErr.message}`);
  }

  // Targets: one per (platform × account) that is BOTH selected AND
  // cloud-connected. Platforms with no cloud row stay local-only (correct —
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
      // idempotency_key is NOT NULL with no default — deterministic so
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
  // (best-effort — a leftover `0.mp4` in this prefix is exactly how a
  // replaced video haunted the next publish).
  try {
    const stale = prevPaths.filter((p) => p && !newPaths.includes(p));
    if (stale.length) {
      await sb.storage.from('post-media').remove(stale).catch(() => ({}));
      const { data: rows } = await sb
        .from('media_assets')
        .select('id, storage_path')
        .eq('workspace_id', wsId)
        .in('storage_path', stale);
      const ids = ((rows ?? []) as any[]).map((r) => String(r.id)).filter(Boolean);
      if (ids.length) await sb.from('media_assets').delete().in('id', ids);
    }
  } catch {}
  // Record the successful push — the pull uses this allowlist to retract
  // rows the web deleted (never-pushed local drafts are untouchable).
  await markPushed(post.id);
  console.log(
    `[cloud] pushed ${post.id}: ${made} target(s), ${linked.length} media for [${(post.platforms ?? []).join(',')}]`,
  );
}

/**
 * Mark one mirrored leg sent (light PATCH — no media re-upload). Called when a
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
  const session = await currentSession().catch(() => null);
  await unmarkPushed(clientId);
  if (!session) return;
  const sb = supabase();
  const { data: prow } = await sb.from('posts').select('id').eq('client_id', clientId).maybeSingle();
  const id = (prow as any)?.id;
  if (!id) return;
  const { error } = await sb.from('posts').delete().eq('id', id);
  if (error) throw new Error(`cloud post delete failed: ${error.message}`);
}

/**
 * Back-sync (the reason pull-to-refresh exists): cloud is the publishing
 * authority, so local Queued flips to Sent only when EVERY cloud target for
 * the post reached sent — collecting remote_ids for the Sent view.
 * Anything else (pending/failed targets) stays queued. Never throws.
 */
export async function pullCloudStatus(): Promise<{ updated: number }> {
  try {
    const session = await currentSession().catch(() => null);
    if (!session) return { updated: 0 };
    const locals = (await loadManagedPosts()).filter((p) => p.status === 'queued');
    if (!locals.length) return { updated: 0 };
    const sb = supabase();
    const { data: cposts } = await sb
      .from('posts')
      .select('id, client_id')
      .in(
        'client_id',
        locals.map((p) => p.id),
      );
    const cloudIdByClient = new Map(
      (((cposts ?? []) as any[]) as { client_id: string; id: string }[]).map((r) => [
        String(r.client_id),
        String(r.id),
      ]),
    );
    const cloudIds = [...cloudIdByClient.values()];
    if (!cloudIds.length) return { updated: 0 };
    const { data: tgts } = await sb
      .from('post_targets')
      .select('post_id, provider, status, remote_id')
      .in('post_id', cloudIds);
    const byPost = new Map<string, any[]>();
    for (const t of ((tgts ?? []) as any[])) {
      const arr = byPost.get(String(t.post_id)) ?? [];
      arr.push(t);
      byPost.set(String(t.post_id), arr);
    }
    let updated = 0;
    for (const p of locals) {
      const cid = cloudIdByClient.get(p.id);
      if (!cid) continue;
      const rows = byPost.get(cid) ?? [];
      if (!rows.length || !rows.every((r) => String(r.status) === 'sent')) continue;
      const remoteIds: Record<string, string> = { ...(p.remoteIds ?? {}) };
      for (const r of rows) {
        if (r.remote_id) remoteIds[String(r.provider)] = String(r.remote_id);
      }
      // saveManagedPost re-mirrors (idempotent upsert of the same state).
      await saveManagedPost({ ...p, status: 'sent', sentAt: Date.now(), remoteIds });
      updated += 1;
    }
    if (updated > 0) console.log(`[cloud] back-sync: ${updated} post(s) → sent`);
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

async function loadPushed(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(PUSHED_KEY);
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
    await AsyncStorage.setItem(PUSHED_KEY, JSON.stringify(trimmed));
  } catch {}
}

async function unmarkPushed(clientId: string): Promise<void> {
  try {
    const cur = await loadPushed();
    if (clientId in cur) {
      delete cur[clientId];
      await AsyncStorage.setItem(PUSHED_KEY, JSON.stringify(cur));
    }
  } catch {}
}

async function loadAdopted(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(ADOPTED_KEY);
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
    await AsyncStorage.setItem(ADOPTED_KEY, JSON.stringify([...cur].slice(-500)));
  } catch {}
}

function cloudStatusToLocal(s: string): ManagedPost['status'] {
  if (s === 'sent') return 'sent';
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

/** Best-effort: fetch one cloud asset to device storage. Null on any failure. */
async function fetchAsset(
  sb: ReturnType<typeof supabase>,
  storagePath: string,
  kind: 'image' | 'video',
  hint: string,
  byteSize: number | null,
): Promise<MediaAttachment | null> {
  try {
    if (kind === 'video' && typeof byteSize === 'number' && byteSize > VIDEO_PULL_CAP) return null;
    const { data, error } = await sb.storage.from('post-media').createSignedUrl(storagePath, 600);
    if (error || !data?.signedUrl) return null;
    const dir = `${FileSystem.documentDirectory}sync/`;
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch {}
    const ext = (storagePath.split('.').pop() ?? (kind === 'video' ? 'mp4' : 'jpg')).slice(0, 4);
    const dest = `${dir}${hint}.${ext}`;
    const dl = await FileSystem.downloadAsync(absUrl(data.signedUrl), dest);
    if (dl.status !== 200) return null;
    return { uri: dl.uri, kind };
  } catch {
    return null;
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
}

interface CloudMediaRow {
  post_id: string;
  position: number;
  media_assets: { id: string; storage_path: string; kind: string; byte_size: number | null } | null;
}

/**
 * Cloud → device post pull: the missing half of post sync. Adopts posts
 * created on the web (tracked by cloud UUID so each is adopted once) and
 * reconciles existing rows — publishing verdicts (sent/failed/…) always win,
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

    const { data: posts, error } = await sb
      .from('posts')
      .select('id, client_id, title, body, status, scheduled_at, updated_at')
      .eq('workspace_id', wsId)
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error || !posts?.length) return out;
    const rows = posts as CloudPostRow[];
    const ids = rows.map((p) => p.id);

    const [{ data: targets }, { data: links }] = await Promise.all([
      sb
        .from('post_targets')
        .select('post_id, provider, status, format, caption, options, remote_id')
        .in('post_id', ids),
      sb
        .from('post_media')
        .select('post_id, position, media_assets!inner(id, storage_path, kind, byte_size)')
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
    const newlyAdopted: string[] = [];

    const buildAttachments = async (postId: string, hint: string): Promise<MediaAttachment[] | null> => {
      const media = (mediaByPost.get(postId) ?? []).filter((m) => m.media_assets?.storage_path);
      if (!media.length) return null;
      const atts: MediaAttachment[] = [];
      for (let i = 0; i < Math.min(media.length, 10); i++) {
        const a = media[i].media_assets!;
        const kind = a.kind === 'video' ? 'video' : 'image';
        const got = await fetchAsset(sb, a.storage_path, kind, `${hint}_${i}`, a.byte_size);
        if (got) atts.push(got);
      }
      return atts.length ? atts : null;
    };

    for (const cp of rows) {
      const cloudTs = (cp.updated_at && Date.parse(cp.updated_at)) || 0;
      const tgts = targetsByPost.get(cp.id) ?? [];
      const platforms = [...new Set(tgts.map((t) => String(t.provider)).filter(Boolean))];
      const scheduledMs = cp.scheduled_at ? Date.parse(cp.scheduled_at) : NaN;

      const existing = cp.client_id ? byClient.get(String(cp.client_id)) : undefined;
      if (existing) {
        const localTs = existing.updatedAt ?? existing.createdAt ?? 0;
        let next: ManagedPost | null = null;
        if (isAuthoritative(cp.status)) {
          const want = cloudStatusToLocal(cp.status === 'sent' ? 'sent' : 'queued');
          const remoteIds: Record<string, string> = { ...(existing.remoteIds ?? {}) };
          for (const t of tgts) {
            if (t.remote_id) remoteIds[String(t.provider)] = String(t.remote_id);
          }
          if (
            existing.status !== want ||
            JSON.stringify(existing.remoteIds ?? {}) !== JSON.stringify(remoteIds)
          ) {
            next = {
              ...existing,
              status: want,
              remoteIds,
              sentAt: want === 'sent' ? Date.now() : existing.sentAt,
            };
          }
        } else if (cloudTs > localTs) {
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
            platforms: platforms.length ? platforms : existing.platforms,
            platformTypes: Object.keys(platformTypes).length
              ? (platformTypes as ManagedPost['platformTypes'])
              : existing.platformTypes,
            thread:
              (threadTgt?.options as { thread?: string[] } | null)?.thread ??
              existing.thread,
            ...(atts ? { attachments: atts, imageUri: undefined, videoUri: undefined } : {}),
          };
        }
        if (next) {
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
      const atts = await buildAttachments(cp.id, hint);
      const platformTypes: Record<string, string> = {};
      for (const t of tgts) {
        if (t.format) platformTypes[t.provider] = t.format;
      }
      const threadTgt = tgts.find(
        (t) => t.options && Array.isArray((t.options as Record<string, unknown>).thread),
      );
      const rec: ManagedPost = {
        id: `cloud_${cp.id.slice(0, 12)}`,
        title: cp.title ?? '',
        body: tgts[0]?.caption ?? cp.body ?? '',
        platforms,
        platformTypes: Object.keys(platformTypes).length
          ? (platformTypes as ManagedPost['platformTypes'])
          : undefined,
        thread: (threadTgt?.options as { thread?: string[] } | null)?.thread,
        scheduledAt: Number.isFinite(scheduledMs) ? scheduledMs : undefined,
        createdAt: cloudTs || Date.now(),
        updatedAt: cloudTs || Date.now(),
        status: cloudStatusToLocal(cp.status),
        attachments: atts ?? undefined,
      };
      await saveManagedPostLocal(rec);
      byClient.set(rec.id, rec);
      try {
        await sb.from('posts').update({ client_id: rec.id }).eq('id', cp.id);
      } catch {}
      newlyAdopted.push(cp.id);
      out.adopted += 1;
    }

    await markAdopted(newlyAdopted);

    // Retraction: a pushed row the web deleted disappears locally too — but
    // only with no newer local edits, and never for never-pushed drafts or
    // adopted-but-unclaimed rows (their client_id isn't in the cloud list).
    const cloudClients = new Set(
      rows.map((p) => (p.client_id ? String(p.client_id) : '')).filter(Boolean),
    );
    const pushed = await loadPushed();
    for (const [cid, pushedTs] of Object.entries(pushed)) {
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

    if (out.adopted + out.updated + out.removed > 0) {
      console.log(`[cloud] pull posts: ${out.adopted} adopted, ${out.updated} updated, ${out.removed} removed`);
    }
    return out;
  } catch {
    return out;
  }
}
