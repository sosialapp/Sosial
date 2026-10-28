/**
 * TikTok publish adapter (Wave D). Ports src/utils/tiktokPublish.ts +
 * refreshTikTokToken to the worker: Vault-backed token (24h access, rotating
 * 1-year refresh), PULL_FROM_URL video posts from our own storage domain
 * (TikTok's guidelines: videos already on our servers are pulled, not
 * re-uploaded) with the FILE_UPLOAD flow (init → 8MB chunked PUTs → poll) only
 * when no verified pull domain is configured, and PULL_FROM_URL photo posts via
 * the user's verified photo host (synced into channel metadata, TikTok rejects
 * any host the user hasn't verified).
 */
import { readSecret, updateSecret } from './db';
import { storageChunks, storageHeadSize, storageSign, storageDownload } from './rest';
import { assertMediaAllowed } from './mediaLimits';
import { env } from './env';
import { info } from './logger';

const TT_TOKEN_ENDPOINT = 'https://open.tiktokapis.com/v2/oauth/token/';
const TT_API = 'https://open.tiktokapis.com';
const CHUNK = 8 * 1024 * 1024;
/** Worker poll ceiling: a retry after init would double-post, so wait out
 *  processing instead of failing fast like the app (60s) does. */
const POLL_MS = 5 * 60 * 1000;
/** Signed video links must outlive TikTok's pull (it may queue for a while). */
const PULL_LINK_SEC = 6 * 60 * 60;

interface Bundle {
  target: { id: string; provider: string; caption: string | null; options: any; status: string };
  post: { id: string; title: string; body: string };
  media: {
    storage_path: string;
    kind: string;
    mime_type: string | null;
    position: number;
    byte_size: number | null;
    duration_ms: number | null;
  }[];
  channel: { id: string; external_id: string; instance_url: string | null; metadata: any };
  secrets: { access_secret_id: string | null; refresh_secret_id: string | null; expires_at: string | null };
}

/** Same human-readable mapping as the app (audit gate, caps, ownership). */
function friendly(code: string, fallback: string): string {
  const tag = code && code !== 'ok' ? ` [${code}]` : '';
  switch (code) {
    case 'unaudited_client_can_only_post_to_private_accounts':
      return 'TikTok rejected it: an unaudited app can only post from accounts added as test users, even “Only me” fails otherwise. Add this TikTok account as a test user in your TikTok developer portal, reconnect TikTok, and retry. Public posting needs TikTok app review.' + tag;
    case 'privacy_level_option_mismatch':
      return 'That privacy setting isn’t allowed for this account, pick another audience and re-queue.' + tag;
    case 'spam_risk_too_many_posts':
      return 'TikTok daily post limit reached, try again tomorrow.' + tag;
    case 'spam_risk_user_banned_from_posting':
      return 'TikTok blocked this account from posting.' + tag;
    case 'reached_active_user_cap':
      return 'TikTok daily publishing quota for this app is reached, try tomorrow.' + tag;
    case 'scope_not_authorized':
      return 'TikTok is missing the video.publish permission, disconnect and reconnect TikTok.' + tag;
    case 'access_token_invalid':
      return 'TikTok session expired, toggle cloud publishing off and on in Connect to refresh.' + tag;
    case 'url_ownership_unverified':
      return 'TikTok only pulls photos from a domain you own and have verified, set the photo host in Connect → TikTok (video posts don’t need it).' + tag;
    case 'picture_size_check_failed':
      return 'TikTok rejected the photo size, photos must fit 1080p (longest side ≤ 1920px). The photo host now resizes automatically, so retry.' + tag;
    default:
      return fallback + tag;
  }
}

/**
 * friendly() plus TikTok's own error.message and log id: invalid_params only
 * names the offending field in the message, so it must reach the user.
 */
function ttFail(j: any, fallback: string): string {
  const msg = String(j?.error?.message ?? '').trim();
  const log = String(j?.error?.log_id ?? j?.error?.logid ?? '').trim();
  return friendly(String(j?.error?.code ?? ''), fallback) + (msg ? ` ${msg}` : '') + (log ? ` (log ${log})` : '');
}

const ok = (j: any): boolean => j?.error?.code === 'ok';
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * The creator's own choices for one TikTok target. TikTok's Content Sharing
 * Guidelines require the surface that publishes to carry them explicitly, so
 * every field here is stored on the target's options by the composer and
 * echoed verbatim to the API: nothing is defaulted here.
 *   disable*      - interaction checkboxes (unchecked in the UI = disabled)
 *   brandOrganic  - "Your brand" disclosure
 *   brandContent  - "Branded content" disclosure (mutually independent)
 */
interface TtOptions {
  privacy: string;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  brandOrganic: boolean;
  brandContent: boolean;
}

/** Video "title" is TikTok's caption field (up to 2200 chars, hashtags included). */
function videoPostInfo(o: TtOptions, caption: string): Record<string, unknown> {
  return {
    ...(caption ? { title: caption.slice(0, 2200) } : {}),
    privacy_level: o.privacy,
    disable_duet: o.disableDuet,
    disable_comment: o.disableComment,
    disable_stitch: o.disableStitch,
    brand_organic_toggle: o.brandOrganic,
    brand_content_toggle: o.brandContent,
  };
}

/** Photo posts carry no duet/stitch fields, TikTok rejects them outright.
 *  Music is never added on the user's behalf (they add it in TikTok). */
function photoPostInfo(o: TtOptions, caption: string): Record<string, unknown> {
  return {
    ...(caption ? { title: (caption.split('\n')[0] ?? '').slice(0, 90), description: caption.slice(0, 4000) } : {}),
    privacy_level: o.privacy,
    disable_comment: o.disableComment,
    auto_add_music: false,
    brand_organic_toggle: o.brandOrganic,
    brand_content_toggle: o.brandContent,
  };
}

/** Read the composer's decisions off a target's options. */
function optionsOf(options: any): TtOptions {
  const o = (options ?? {}) as Record<string, unknown>;
  return {
    privacy: String(o.ttPrivacy ?? '').trim(),
    disableComment: o.ttDisableComment === true,
    disableDuet: o.ttDisableDuet === true,
    disableStitch: o.ttDisableStitch === true,
    brandOrganic: o.ttBrandOrganic === true,
    brandContent: o.ttBrandContent === true,
  };
}

async function patchExpiry(channelId: string, expiresAt: Date): Promise<void> {
  const { required } = await import('./env.js');
  const base = required('WORKER_SUPABASE_URL').replace(/\/+$/, '');
  const k = required('WORKER_SERVICE_ROLE_KEY');
  const r = await fetch(`${base}/rest/v1/channel_tokens?channel_id=eq.${encodeURIComponent(channelId)}`, {
    method: 'PATCH',
    headers: {
      apikey: k,
      Authorization: `Bearer ${k}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ expires_at: expiresAt.toISOString(), updated_at: new Date().toISOString() }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`patch channel_tokens (${r.status}): ${t.slice(0, 200)}`);
  }
}

/** TikTok client key/secret, same pair the app ships as EXPO_PUBLIC_TT_*. */
function clientCreds(): { key: string; secret: string } {
  const key = env('TT_CLIENT_KEY') || env('TIKTOK_CLIENT_KEY');
  const secret = env('TT_CLIENT_SECRET') || env('TIKTOK_CLIENT_SECRET');
  if (!key || !secret) {
    throw new Error('TikTok cloud publishing needs TT_CLIENT_KEY + TT_CLIENT_SECRET on the worker (see apps/worker/.env.example).');
  }
  return { key, secret };
}

/** Valid access token, refreshing 10 min before expiry (Vault-backed). */
export async function ensureToken(b: Bundle, force = false): Promise<string> {
  const fresh =
    !force && b.secrets.expires_at && Date.parse(b.secrets.expires_at) > Date.now() + 600000;
  if (fresh && b.secrets.access_secret_id) {
    const access = await readSecret(b.secrets.access_secret_id);
    if (access) return access;
  }
  if (!b.secrets.refresh_secret_id) {
    throw new Error('TikTok session expired, toggle cloud publishing off and on in Connect to refresh.');
  }
  const refresh = await readSecret(b.secrets.refresh_secret_id);
  if (!refresh) throw new Error('TikTok session expired, toggle cloud publishing off and on in Connect to refresh.');
  const { key, secret } = clientCreds();
  const r = await fetch(TT_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: key,
      client_secret: secret,
      grant_type: 'refresh_token',
      refresh_token: refresh,
    }).toString(),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!j?.access_token) {
    const msg = String(j?.error?.message || j?.error?.code || 'TikTok session expired');
    if (/invalid_grant|invalid_request/i.test(msg)) {
      throw new Error('TikTok session expired, reconnect TikTok.');
    }
    throw new Error(`${msg}, toggle cloud publishing off and on in Connect to refresh.`);
  }
  const newAccess = String(j.access_token);
  const newRefresh = String(j.refresh_token || refresh);
  if (b.secrets.access_secret_id) await updateSecret(b.secrets.access_secret_id, newAccess);
  await updateSecret(b.secrets.refresh_secret_id, newRefresh);
  await patchExpiry(b.channel.id, new Date(Date.now() + Number(j.expires_in ?? 86400) * 1000));
  return newAccess;
}

function videoMimeFor(path: string, declared: string | null): string {
  if (declared && /^video\//.test(declared)) return declared;
  const u = path.toLowerCase().split('?')[0];
  if (u.endsWith('.mov')) return 'video/quicktime';
  if (u.endsWith('.webm')) return 'video/webm';
  return 'video/mp4';
}

/** Poll one publish until terminal (bounded, see POLL_MS). */
async function pollStatus(publishId: string, token: string, kind: string): Promise<void> {
  const start = Date.now();
  let delay = 3000;
  for (;;) {
    const s = await fetch(`${TT_API}/v2/post/publish/status/fetch/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const sj: any = await s.json().catch(() => ({}));
    const status = String(sj?.data?.status ?? '');
    if (status === 'PUBLISH_COMPLETE') return;
    if (status === 'FAILED') {
      const code = String(sj?.error?.code ?? '');
      // TikTok puts the human-readable cause in data.fail_reason (error.code is
      // often empty on failures), without it we can only guess.
      const reason = String(sj?.data?.fail_reason ?? '').trim();
      const detail = reason ? `, ${reason}` : '';
      // Empty/'ok' code with no reason means the crawler never fetched the file.
      if ((!code || code === 'ok') && !reason) {
        throw new Error(
          kind === 'video'
            ? 'TikTok could not download the video from storage, check the storage domain is verified in the TikTok developer portal (URL properties) and listed in TT_PULL_HOSTS.'
            : `TikTok could not download the ${kind} from your photo host, check (1) the domain is verified in the TikTok developer portal, (2) the photos.sosial.app DNS record is DNS-only (grey cloud, not proxied), (3) the file is still live (host links expire after 24h).`,
        );
      }
      if (!code || code === 'ok') {
        throw new Error(`TikTok failed to process the ${kind}${detail}`);
      }
      throw new Error(friendly(code, `TikTok failed to process the ${kind}.`) + detail);
    }
    if (Date.now() - start > POLL_MS) {
      throw new Error('TikTok is still processing, check the TikTok app in a few minutes (the post may still land).');
    }
    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.5), 10000);
  }
}

/**
 * FILE_UPLOAD flow: init (JSON) → sequential 8 MB PUTs streamed from storage →
 * poll. Only one chunk is in memory at a time, so multi-GB videos work.
 * `totalBytes` must be exact, it drives chunk math and TikTok's own check.
 */
async function publishVideo(
  token: string,
  totalBytes: number,
  chunks: AsyncGenerator<Buffer>,
  mime: string,
  title: string,
  tt: TtOptions,
): Promise<string> {
  if (!totalBytes) throw new Error('Video is empty, re-attach it and re-queue.');
  // TikTok's media transfer rules: total_chunk_count = video_size / chunk_size
  // rounded DOWN, and the remainder rides on the last chunk (up to 128 MB).
  // Rounding up is refused at init with invalid_params.
  const chunkSize = Math.min(CHUNK, totalBytes);
  const totalChunks = Math.max(1, Math.floor(totalBytes / chunkSize));
  info(
    `tiktok init FILE_UPLOAD size=${totalBytes} chunk=${chunkSize} count=${totalChunks} ` +
      `privacy=${tt.privacy} titleLen=${title.length} brandOrganic=${tt.brandOrganic} brandContent=${tt.brandContent}`,
  );
  const init = await fetch(`${TT_API}/v2/post/publish/video/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: videoPostInfo(tt, title),
      source_info: { source: 'FILE_UPLOAD', video_size: totalBytes, chunk_size: chunkSize, total_chunk_count: totalChunks },
    }),
  });
  const initJ: any = await init.json().catch(() => ({}));
  const publishId = String(initJ?.data?.publish_id ?? '');
  const uploadUrl = String(initJ?.data?.upload_url ?? '');
  if (!ok(initJ) || !publishId || !uploadUrl) {
    throw new Error(ttFail(initJ, 'TikTok upload init failed.'));
  }
  let sent = 0;
  let part = 0;
  const putPart = async (buf: Buffer): Promise<void> => {
    const start = sent;
    const end = start + buf.length;
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mime, 'Content-Range': `bytes ${start}-${end - 1}/${totalBytes}` },
      body: Uint8Array.from(buf),
    });
    await put.arrayBuffer().catch(() => null);
    if (put.status !== 200 && put.status !== 201 && put.status !== 206) {
      throw new Error(`TikTok upload stalled on part ${part + 1}/${totalChunks}, the job will retry shortly.`);
    }
    sent = end;
    part += 1;
  };
  // Every part but the last goes out as read; the last absorbs the remainder.
  const tail: Buffer[] = [];
  for await (const chunk of chunks) {
    if (part < totalChunks - 1) await putPart(chunk);
    else tail.push(chunk);
  }
  if (tail.length) await putPart(Buffer.concat(tail));
  if (sent !== totalBytes) {
    throw new Error(`TikTok upload delivered ${sent}/${totalBytes} bytes, the job will retry shortly.`);
  }
  await pollStatus(publishId, token, 'video');
  return publishId;
}

/**
 * A signed link to the stored video, when its host is one we verified with
 * TikTok (TT_PULL_HOSTS, comma-separated domains, subdomains included).
 * Null means pull isn't configured, so the caller falls back to FILE_UPLOAD.
 */
async function videoPullUrl(path: string): Promise<string | null> {
  const hosts = String(env('TT_PULL_HOSTS') ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (!hosts.length) return null;
  const url = await storageSign('post-media', path, PULL_LINK_SEC);
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
    info(`tiktok: storage host ${host} is not in TT_PULL_HOSTS, using FILE_UPLOAD`);
    return null;
  }
  return url;
}

/** PULL_FROM_URL flow: init with our signed link → TikTok fetches it → poll. */
async function publishVideoFromUrl(token: string, url: string, title: string, tt: TtOptions): Promise<string> {
  const init = await fetch(`${TT_API}/v2/post/publish/video/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: videoPostInfo(tt, title),
      source_info: { source: 'PULL_FROM_URL', video_url: url },
    }),
  });
  const j: any = await init.json().catch(() => ({}));
  const publishId = String(j?.data?.publish_id ?? '');
  if (!ok(j) || !publishId) {
    throw new Error(ttFail(j, 'TikTok video post failed.'));
  }
  await pollStatus(publishId, token, 'video');
  return publishId;
}

/** Upload one photo's bytes to the user's verified host (same contract as the app). */
async function hostPhoto(host: string, buf: Buffer, mime: string, tag: string): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buf) as unknown as BlobPart], { type: mime }), 'sosial.jpg');
  const r = await fetch(host, { method: 'POST', body: form });
  const txt = (await r.text().catch(() => '')).trim();
  if (r.status >= 200 && r.status < 300) {
    if (txt.startsWith('http')) return txt;
    try {
      const j = JSON.parse(txt);
      const u = String(j?.url ?? j?.data?.url ?? '');
      if (u.startsWith('http')) return u;
    } catch {}
  }
  throw new Error(`${tag}: photo host rejected the upload, check the host in Connect → TikTok.`);
}

async function publishPhotos(token: string, urls: string[], title: string, tt: TtOptions): Promise<string> {
  const init = await fetch(`${TT_API}/v2/post/publish/content/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: photoPostInfo(tt, title),
      source_info: { source: 'PULL_FROM_URL', photo_images: urls, photo_cover_index: 0 },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO',
    }),
  });
  const j: any = await init.json().catch(() => ({}));
  const publishId = String(j?.data?.publish_id ?? '');
  if (!ok(j) || !publishId) {
    throw new Error(ttFail(j, 'TikTok photo post failed.'));
  }
  await pollStatus(publishId, token, 'photos');
  return publishId;
}

/** Who posts, what TikTok lets them pick, and what their account disallows. */
interface TtCreatorInfo {
  nickname: string;
  privacyOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number;
}

/**
 * Required by TikTok's Content Sharing Guidelines: the composer must be fed by
 * live creator info, never a cached guess. The background run uses it to
 * validate the user's choices; a failure here is not fatal to the publish
 * itself (TikTok re-checks), so it degrades to empty defaults.
 */
/** creator_info codes meaning "this creator cannot post now" (can_post = false). */
const CANNOT_POST = new Set(['spam_risk_too_many_posts', 'spam_risk_user_banned_from_posting', 'reached_active_user_cap']);

class CannotPost extends Error {}

async function creatorInfo(token: string): Promise<TtCreatorInfo> {
  const empty: TtCreatorInfo = {
    nickname: '',
    privacyOptions: [],
    commentDisabled: false,
    duetDisabled: false,
    stitchDisabled: false,
    maxVideoPostDurationSec: 0,
  };
  try {
    const r = await fetch(`${TT_API}/v2/post/publish/creator_info/query/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: '{}',
    });
    const j: any = await r.json().catch(() => ({}));
    const code = String(j?.error?.code ?? '');
    if (CANNOT_POST.has(code)) throw new CannotPost(friendly(code, 'TikTok says this account can’t post right now.'));
    if (!ok(j) || !j?.data) return empty;
    const d = j.data;
    return {
      nickname: String(d.creator_nickname ?? ''),
      privacyOptions: Array.isArray(d.privacy_level_options) ? (d.privacy_level_options as unknown[]).map(String) : [],
      commentDisabled: d.comment_disabled === true,
      duetDisabled: d.duet_disabled === true,
      stitchDisabled: d.stitch_disabled === true,
      maxVideoPostDurationSec: Number(d.max_video_post_duration_sec ?? 0) || 0,
    };
  } catch (e) {
    if (e instanceof CannotPost) throw e;
    return empty;
  }
}

/** Full target publish. TikTok returns a publish id (no public URL yet). */
export async function publishTikTokTarget(bundle: Bundle): Promise<{ publishId: string }> {
  const b = bundle as Bundle;
  const token = await ensureToken(b);
  const tt = optionsOf(b.target.options);
  const creator = await creatorInfo(token);
  if (!tt.privacy) {
    // TikTok's guidelines: the creator picks the audience, it is never
    // defaulted (not even when the account offers a single level). Posts made
    // outside the composer (API, imports) must carry one.
    throw new Error('TikTok audience not chosen, open the post in Create, pick an audience, and re-queue.');
  }
  // Never silently widen or narrow the audience: TikTok refuses levels the
  // creator lost since the post was composed, and guessing would publish to a
  // different audience than the user picked.
  if (creator.privacyOptions.length && !creator.privacyOptions.includes(tt.privacy)) {
    throw new Error(
      `TikTok no longer allows the audience this post was queued with (${tt.privacy}). Open the post, pick another audience and re-queue.`,
    );
  }
  // Branded content cannot be private, TikTok rejects SELF_ONLY outright.
  if (tt.brandContent && tt.privacy === 'SELF_ONLY') {
    throw new Error('Branded content cannot be posted with "Only me", pick another audience and re-queue.');
  }
  // The user's own caption, untouched: no app-branded fallback text.
  const title = (b.target.caption ?? b.post.body ?? '').trim();
  const videos = (b.media ?? [])
    .filter((m) => m.kind === 'video')
    .sort((a, z) => a.position - z.position);
  const images = (b.media ?? [])
    .filter((m) => m.kind === 'image')
    .sort((a, z) => a.position - z.position);

  // TikTok has no mixed-media post (single video OR up to 35 photos), so a
  // draft holding both would silently drop the photos. Fail loudly instead.
  if (videos.length > 0 && images.length > 0) {
    throw new Error('TikTok can’t mix photos and video, send one or the other.');
  }

  if (videos.length > 0) {
    const maxSec = creator.maxVideoPostDurationSec;
    const durMs = videos[0].duration_ms ?? 0;
    if (maxSec > 0 && durMs > maxSec * 1000 + 500) {
      throw new Error(
        `TikTok allows this account up to ${Math.round(maxSec / 60)} min per video, this one is ${Math.round(durMs / 60000)} min. Trim it and re-queue.`,
      );
    }
    await assertMediaAllowed('tiktok', [videos[0]], async () => {
      if (videos[0].byte_size) return videos[0].byte_size;
      const head = await storageHeadSize('post-media', videos[0].storage_path);
      if (head === null) throw new Error('Video: could not read its size from storage.');
      return head;
    });
    // The video already lives in our storage, so TikTok pulls it from our
    // verified domain instead of us re-uploading it.
    const pullUrl = await videoPullUrl(videos[0].storage_path);
    if (pullUrl) {
      info(`tiktok target ${b.target.id}: VIDEO (${tt.privacy}), PULL_FROM_URL`);
      return { publishId: await publishVideoFromUrl(token, pullUrl, title, tt) };
    }
    info(`tiktok target ${b.target.id}: VIDEO (${tt.privacy}), FILE_UPLOAD`);
    const size = videos[0].byte_size ?? (await storageHeadSize('post-media', videos[0].storage_path));
    if (!size) throw new Error('Video is empty, re-attach it and re-queue.');
    const chunks = storageChunks('post-media', videos[0].storage_path, CHUNK);
    const publishId = await publishVideo(
      token,
      size,
      chunks,
      videoMimeFor(videos[0].storage_path, videos[0].mime_type),
      title,
      tt,
    );
    return { publishId };
  }
  if (images.length > 0) {
    // Per-channel override wins; otherwise the shared host from TT_PHOTO_HOST
    // (server-side only, never EXPO_PUBLIC_) so every account just works.
    const host = String(b.channel.metadata?.ttPhotoHost ?? env('TT_PHOTO_HOST') ?? '').trim().replace(/\/+$/, '');
    if (!host) {
      throw new Error('TikTok photo posts need a photo host, set TT_PHOTO_HOST on the worker (or a Connect → TikTok override).');
    }
    info(`tiktok target ${b.target.id}: PHOTOS x${images.length} (${tt.privacy})`);
    const urls: string[] = [];
    for (let i = 0; i < Math.min(images.length, 35); i++) {
      const m = images[i];
      let raw: Buffer;
      try {
        raw = await storageDownload(await storageSign('post-media', m.storage_path));
      } catch (e: any) {
        throw new Error(`Photo ${i + 1}: download failed, ${e?.message ?? 'storage error'}`);
      }
      const mime = /^image\//.test(m.mime_type ?? '') ? String(m.mime_type) : 'image/jpeg';
      urls.push(await hostPhoto(host, raw, mime, `Photo ${i + 1}`));
    }
    const publishId = await publishPhotos(token, urls, title, tt);
    return { publishId };
  }
  throw new Error('TikTok needs a photo or video, text-only is not allowed by their API.');
}
