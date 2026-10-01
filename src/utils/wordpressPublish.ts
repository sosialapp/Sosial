/**
 * Native WordPress publishing (per-site Application Password). Mirrors
 * apps/worker/src/wordpress.ts: featured image via /wp/v2/media, then the
 * post as paragraph blocks with status=publish. Categories/tags/excerpt are
 * v1 omissions (no composer fields yet) — WordPress defaults apply.
 *
 * Multipart uploads go through XMLHttpRequest — expo/fetch (SDK 57) can't
 * serialize React Native {uri,name,type} FormData parts (see mastodonPublish).
 */

import { siteBase, wpAuthHeader } from './wordpressAuth';

async function wpJson<T>(base: string, auth: string, path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${base}/wp-json${path}`, {
    method: 'POST',
    headers: { Authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok || !json) {
    const detail =
      typeof json?.message === 'string' && json.message ? json.message : `HTTP ${res.status}`;
    throw new Error(`WordPress refused the request: ${detail}`);
  }
  return json;
}

function xhrUpload<T>(
  base: string,
  auth: string,
  uri: string,
  mime: string,
  timeoutMs = 180000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', { uri, name: 'sosial.jpg', type: mime } as any);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base}/wp-json/wp/v2/media`);
    xhr.setRequestHeader('Authorization', auth);
    xhr.setRequestHeader('Content-Disposition', 'attachment; filename="sosial.jpg"');
    xhr.timeout = timeoutMs;
    xhr.onload = () => {
      let j: any = null;
      try {
        j = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status < 200 || xhr.status >= 300 || !j?.id) {
        const detail = typeof j?.message === 'string' && j.message ? j.message : `HTTP ${xhr.status}`;
        return reject(new Error(`WordPress refused the upload: ${detail}`));
      }
      resolve(j as T);
    };
    xhr.onerror = () => reject(new Error('Network request failed — check your connection.'));
    xhr.ontimeout = () => reject(new Error('WordPress upload timed out — try again.'));
    xhr.send(form as any);
  });
}

function mimeFor(uri: string): string {
  const u = uri.toLowerCase().split('?')[0];
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function toBlocks(title: string, body: string): { title: string; content: string } {
  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<!-- wp:paragraph --><p>${p.replace(/\n/g, '<br>')}</p><!-- /wp:paragraph -->`);
  return {
    title: title.trim() || paras[0]?.replace(/<[^>]+>/g, '').slice(0, 80) || 'Untitled',
    content: paras.join('\n'),
  };
}

/**
 * Publish a post. Returns the WordPress post id for the queue.
 * Title falls back to the first line when the composer sends none.
 */
export async function publishWordPress(opts: {
  siteUrl: string;
  username: string;
  appPassword: string;
  title: string;
  text: string;
  imageUris?: string[];
}): Promise<string> {
  const { siteUrl, username, appPassword } = opts;
  if (!siteUrl || !username || !appPassword) throw new Error('WordPress not connected');
  const base = siteBase(siteUrl);
  const auth = wpAuthHeader(username, appPassword);

  const image = (opts.imageUris ?? []).filter(Boolean)[0];
  let featuredId = 0;
  if (image) {
    try {
      const uploaded = await xhrUpload<{ id: number }>(base, auth, image, mimeFor(image));
      featuredId = Number(uploaded.id) || 0;
    } catch (e: any) {
      throw new Error(`Featured image: ${e?.message ?? 'upload failed'}`);
    }
  }

  const title = (opts.title ?? '').trim() || (opts.text ?? '').trim().split('\n')[0].slice(0, 80);
  const { title: finalTitle, content } = toBlocks(title, opts.text ?? '');
  if (!content && !featuredId) {
    throw new Error('Write something or attach a featured image — WordPress needs one of them.');
  }
  const created = await wpJson<{ id: number }>(base, auth, '/wp/v2/posts', {
    title: finalTitle,
    content,
    status: 'publish',
    ...(featuredId ? { featured_media: featuredId } : {}),
  });
  if (!created?.id) throw new Error('WordPress post failed.');
  return String(created.id);
}
