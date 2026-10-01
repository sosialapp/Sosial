import { readSecret } from './db';
import { storageDownload, storageSign } from './rest';
import { info } from './logger';

/**
 * VK publisher (community access key, wall.post as the community).
 *
 * VK user-OAuth token flows were retired in 2024 and user-wall posting is
 * support-gated, so Sosial posts to owned communities/pages only: the admin
 * mints an unlimited community access key (Community → Manage → Working
 * with API → Access Tokens, wall + photos rights) and connects with it.
 * - Validation: groups.getById (proves the key, names the community)
 * - Publish: wall.post {owner_id:-gid, from_group:1, message, attachments}
 * - Images: photos.getWallUploadServer → multipart upload →
 *   photos.saveWallPhoto → photo{owner}_{id} (up to 10 per post)
 * Videos need the video.save upload dance + processing poll and are a v1
 * omission (compat declares no video) — VK defaults apply otherwise.
 */

interface Bundle {
  target: { id: string; provider: string; caption: string | null; options: Record<string, unknown> | null; status: string };
  post: { id: string; title: string; body: string };
  media: { storage_path: string; kind: string; mime_type: string | null; position: number }[];
  channel: { id: string; external_id: string; instance_url: string | null; metadata: Record<string, unknown> | null };
  secrets: { access_secret_id: string | null; refresh_secret_id: string | null; expires_at: string | null };
}

const API = 'https://api.vk.com/method';
const V = '5.131';

interface VkError {
  error?: { error_code?: number; error_msg?: string };
}

async function vk<T>(token: string, method: string, params: Record<string, string>): Promise<T> {
  const body = new URLSearchParams({ access_token: token, v: V, ...params });
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await res.json().catch(() => null)) as (T & VkError) | null;
  const err = json?.error?.error_msg;
  if (!res.ok || !json || err) {
    throw new Error(`VK refused the request: ${err ?? `HTTP ${res.status}`}`);
  }
  return json;
}

function groupId(externalId: string): string {
  const gid = String(externalId ?? '').trim();
  if (!/^\d+$/.test(gid)) {
    throw new Error('VK community id is missing — reconnect the channel in Connect.');
  }
  return gid;
}

async function uploadWallPhoto(
  token: string,
  gid: string,
  bytes: Uint8Array,
  mime: string,
): Promise<string> {
  const srv = await vk<{ response: { upload_url: string } }>(token, 'photos.getWallUploadServer', {
    group_id: gid,
  });
  const uploadUrl = srv.response?.upload_url;
  if (!uploadUrl) throw new Error('VK did not return an upload URL.');
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const form = new FormData();
  form.append('photo', new Blob([bytes as BlobPart], { type: mime }), `sosial.${ext}`);
  const upRes = await fetch(uploadUrl, { method: 'POST', body: form });
  const up = (await upRes.json().catch(() => null)) as {
    server?: number;
    photo?: string;
    hash?: string;
  } | null;
  if (!upRes.ok || !up?.server || !up.photo || !up.hash) {
    throw new Error('VK rejected the photo upload.');
  }
  const saved = await vk<{ response: { id: number; owner_id: number }[] }>(token, 'photos.saveWallPhoto', {
    group_id: gid,
    photo: up.photo,
    server: String(up.server),
    hash: up.hash,
  });
  const photo = saved.response?.[0];
  if (!photo?.id) throw new Error('VK did not save the photo.');
  return `photo${photo.owner_id}_${photo.id}`;
}

export async function publishVkTarget(bundle: Bundle): Promise<{ remoteId: string; remoteUrl: string }> {
  const b = bundle;
  const gid = groupId(b.channel.external_id);
  if (!b.secrets.access_secret_id) {
    throw new Error('VK access key is missing — reconnect the channel in Connect.');
  }
  const token = await readSecret(b.secrets.access_secret_id);
  if (!token) {
    throw new Error('VK access key is missing — reconnect the channel in Connect.');
  }

  const text = (b.target.caption ?? b.post.body ?? '').trim();
  const images = [...(b.media ?? [])]
    .filter((m) => m.kind === 'image')
    .sort((a, z) => a.position - z.position)
    .slice(0, 10);

  const attachments: string[] = [];
  for (const img of images) {
    const bytes = await storageDownload(
      await storageSign('post-media', img.storage_path),
      25 * 1024 * 1024,
    );
    attachments.push(await uploadWallPhoto(token, gid, bytes, img.mime_type ?? 'image/jpeg'));
  }

  if (!text && attachments.length === 0) {
    throw new Error('VK needs text or a photo — this post has neither.');
  }
  const posted = await vk<{ response: { post_id: number } }>(token, 'wall.post', {
    owner_id: `-${gid}`,
    from_group: '1',
    message: text,
    ...(attachments.length ? { attachments: attachments.join(',') } : {}),
  });
  const postId = posted.response?.post_id;
  if (!postId) throw new Error('VK publish failed.');
  info('vk wall post published', { target: b.target.id, post: postId });
  return { remoteId: String(postId), remoteUrl: `https://vk.com/wall-${gid}_${postId}` };
}

/** Connect-time validation: groups.getById proves the key and names the community. */
export async function vkValidate(
  token: string,
  group: string,
): Promise<{ groupId: string; groupName: string; screenName: string }> {
  const key = token.trim();
  if (!key) throw new Error('Access key required.');
  const raw = group.trim();
  if (!raw) throw new Error('Community required.');
  // Accept a numeric id, a screen name, or a full vk.com URL.
  let screen: string | null = null;
  let numeric: string | null = null;
  const urlMatch = raw.match(/vk\.com\/([A-Za-z0-9_.]+)/i);
  const ident = urlMatch?.[1] ?? raw;
  if (/^(club|public)\d+$/i.test(ident)) numeric = ident.replace(/^\D+/i, '');
  else if (/^\d+$/.test(ident)) numeric = ident;
  else screen = ident.replace(/^@/, '');
  if (!numeric && screen) {
    try {
      const resolved = await vk<{ response: { type?: string; object_id?: number }[] }>(
        key,
        'utils.resolveScreenName',
        { screen_name: screen },
      );
      const hit = resolved.response?.[0];
      if (hit?.type === 'group' && hit.object_id) numeric = String(hit.object_id);
    } catch {
      /* fall through to the group lookup error */
    }
  }
  if (!numeric) {
    throw new Error(
      'VK could not find that community. Use its numeric id (club123 → 123), short name, or full vk.com link.',
    );
  }
  try {
    const got = await vk<{ response: { items?: { id: number; name: string; screen_name?: string }[] } | { id: number; name: string; screen_name?: string }[] }>(
      key,
      'groups.getById',
      { group_id: numeric },
    );
    const list = Array.isArray(got.response) ? got.response : got.response?.items ?? [];
    const g = list[0];
    if (!g?.id) throw new Error('not found');
    return {
      groupId: String(g.id),
      groupName: g.name || `Community ${g.id}`,
      screenName: g.screen_name || '',
    };
  } catch (e) {
    throw new Error(
      `VK rejected those credentials: ${e instanceof Error ? e.message : 'unknown error'}. ` +
        'Check the community access key (Manage → Working with API → Access Tokens, wall + photos rights) and that the key belongs to this community.',
    );
  }
}
