/**
 * Native VK publishing (community access key). Mirrors
 * apps/worker/src/vk.ts: wall.post as the community (owner_id:-gid,
 * from_group:1) with up to 10 uploaded photos. Videos need the video.save
 * dance + processing poll and are a v1 omission — compat declares no video.
 *
 * Multipart uploads go through XMLHttpRequest — expo/fetch (SDK 57) can't
 * serialize React Native {uri,name,type} FormData parts (see mastodonPublish).
 */

const API = 'https://api.vk.com/method';
const V = '5.131';

interface VkEnvelope<T> {
  response?: T;
  error?: { error_code?: number; error_msg?: string };
}

async function vk<T>(token: string, method: string, params: Record<string, string>): Promise<T> {
  const body = new URLSearchParams({ access_token: token, v: V, ...params });
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => null)) as VkEnvelope<T> | null;
  const err = json?.error?.error_msg;
  if (!res.ok || !json || err || json.response === undefined) {
    throw new Error(`VK refused the request: ${err ?? `HTTP ${res.status}`}`);
  }
  return json.response as T;
}

function mimeFor(uri: string): string {
  const u = uri.toLowerCase().split('?')[0];
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function extFor(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

function xhrUpload<T>(uploadUrl: string, uri: string, mime: string, timeoutMs = 180000): Promise<T> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('photo', { uri, name: `sosial.${extFor(mime)}`, type: mime } as any);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.timeout = timeoutMs;
    xhr.onload = () => {
      let j: any = null;
      try {
        j = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status < 200 || xhr.status >= 300 || !j || j.error) {
        const detail =
          typeof j?.error === 'string' && j.error ? j.error : `HTTP ${xhr.status}`;
        return reject(new Error(`VK rejected the photo upload: ${detail}`));
      }
      resolve(j as T);
    };
    xhr.onerror = () => reject(new Error('Network request failed — check your connection.'));
    xhr.ontimeout = () => reject(new Error('VK upload timed out — try again.'));
    xhr.send(form as any);
  });
}

async function uploadWallPhoto(token: string, groupId: string, uri: string): Promise<string> {
  const srv = await vk<{ upload_url: string }>(token, 'photos.getWallUploadServer', {
    group_id: groupId,
  });
  if (!srv.upload_url) throw new Error('VK did not return an upload URL.');
  const mime = mimeFor(uri);
  const up = await xhrUpload<{ server?: number; photo?: string; hash?: string }>(
    srv.upload_url,
    uri,
    mime,
  );
  if (!up.server || !up.photo || !up.hash) throw new Error('VK rejected the photo upload.');
  const saved = await vk<{ id: number; owner_id: number }[]>(token, 'photos.saveWallPhoto', {
    group_id: groupId,
    photo: up.photo,
    server: String(up.server),
    hash: up.hash,
  });
  const photo = Array.isArray(saved) ? saved[0] : null;
  if (!photo?.id) throw new Error('VK did not save the photo.');
  return `photo${photo.owner_id}_${photo.id}`;
}

/**
 * Publish a wall post. Returns the VK post id for the queue.
 */
export async function publishVk(opts: {
  token: string;
  groupId: string;
  text: string;
  imageUris: string[];
}): Promise<string> {
  const { token, groupId } = opts;
  if (!token || !/^\d+$/.test(String(groupId ?? ''))) throw new Error('VK not connected');
  const text = (opts.text ?? '').trim();
  const uris = (opts.imageUris ?? []).slice(0, 10);
  const attachments: string[] = [];
  for (const uri of uris) {
    attachments.push(await uploadWallPhoto(token, String(groupId), uri));
  }
  if (!text && attachments.length === 0) {
    throw new Error('VK needs text or a photo — this post has neither.');
  }
  const posted = await vk<{ post_id: number }>(token, 'wall.post', {
    owner_id: `-${groupId}`,
    from_group: '1',
    message: text,
    ...(attachments.length ? { attachments: attachments.join(',') } : {}),
  });
  if (!posted.post_id) throw new Error('VK publish failed.');
  return String(posted.post_id);
}
