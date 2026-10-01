import { readSecret } from './db';
import { storageDownload, storageSign } from './rest';
import { info } from './logger';

/**
 * WordPress publisher (per-site Application Passwords, WP REST API).
 *
 * Verified surface (stable for years across WP 5.6+):
 * - GET  {site}/wp-json/wp/v2/users/me            (connect validation)
 * - GET  {site}/wp-json/                           (site name for display)
 * - POST {site}/wp-json/wp/v2/media               (multipart file → {id})
 * - POST {site}/wp-json/wp/v2/posts               ({title, content, featured_media, status})
 * Auth is Basic base64(user:app-password) on every call. Publishing uses
 * status=publish at the scheduled time — Sosial's worker owns the clock,
 * so WP-native scheduling is never used. Categories/tags/excerpt/slug are
 * v1 omissions (no composer fields for them yet) — WordPress defaults apply.
 */

interface Bundle {
  target: { id: string; provider: string; caption: string | null; options: Record<string, unknown> | null; status: string };
  post: { id: string; title: string; body: string };
  media: { storage_path: string; kind: string; mime_type: string | null; position: number }[];
  channel: { id: string; external_id: string; instance_url: string | null; metadata: Record<string, unknown> | null };
  secrets: { access_secret_id: string | null; refresh_secret_id: string | null; expires_at: string | null };
}

export function siteBase(instanceUrl: string | null): string {
  const base = String(instanceUrl ?? '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) {
    throw new Error('WordPress site URL must start with http(s) — reconnect the channel.');
  }
  return base;
}

function authHeader(username: string, appPassword: string): string {
  return `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`;
}

async function wp<T>(base: string, auth: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}/wp-json${path}`, {
    ...init,
    headers: { Authorization: auth, ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => null)) as (T & { message?: string; code?: string }) | null;
  if (!res.ok || !json) {
    const detail =
      typeof json?.message === 'string' && json.message ? json.message : `HTTP ${res.status}`;
    throw new Error(`WordPress refused the request: ${detail}`);
  }
  return json;
}

/** Plain-text body → paragraph blocks (renders correctly in every theme). */
function toBlocks(title: string, body: string): { title: string; content: string } {
  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<!-- wp:paragraph --><p>${p.replace(/\n/g, '<br>')}</p><!-- /wp:paragraph -->`);
  return { title: title.trim() || paras[0]?.replace(/<[^>]+>/g, '').slice(0, 80) || 'Untitled', content: paras.join('\n') };
}

export async function publishWordPressTarget(bundle: Bundle): Promise<{ remoteId: string; remoteUrl: string }> {
  const b = bundle;
  const base = siteBase(b.channel.instance_url);
  const username = String(b.channel.metadata?.username ?? '').trim();
  if (!username) throw new Error('WordPress username is missing — reconnect the channel.');
  if (!b.secrets.access_secret_id) {
    throw new Error('WordPress application password is missing — reconnect the channel.');
  }
  const appPassword = await readSecret(b.secrets.access_secret_id);
  if (!appPassword) {
    throw new Error('WordPress application password is missing — reconnect the channel.');
  }
  const auth = authHeader(username, appPassword);

  const text = (b.target.caption ?? b.post.body ?? '').trim();
  const media = [...(b.media ?? [])]
    .filter((m) => m.kind === 'image' || m.kind === 'video')
    .sort((a, z) => a.position - z.position);

  // Featured image: first image only (WordPress posts take one).
  let featuredId = 0;
  const firstImage = media.find((m) => m.kind === 'image');
  if (firstImage) {
    const bytes = await storageDownload(
      await storageSign('post-media', firstImage.storage_path),
      25 * 1024 * 1024,
    );
    const mime = firstImage.mime_type ?? 'image/jpeg';
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(bytes)], { type: mime }),
      `sosial-${Date.now()}.${mime.includes('png') ? 'png' : 'jpg'}`,
    );
    const uploaded = await wp<{ id: number }>(base, auth, '/wp/v2/media', {
      method: 'POST',
      headers: { 'Content-Disposition': 'attachment; filename="sosial.jpg"' },
      body: form,
    });
    featuredId = Number(uploaded.id) || 0;
  }

  const { title, content } = toBlocks(b.post.title ?? '', text);
  if (!content && !featuredId) {
    throw new Error('WordPress needs text or a featured image — this post has neither.');
  }
  const created = await wp<{ id: number; link: string }>(base, auth, '/wp/v2/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title,
      content,
      status: 'publish',
      ...(featuredId ? { featured_media: featuredId } : {}),
    }),
  });
  info('wordpress post published', { target: b.target.id, post: created.id });
  return { remoteId: String(created.id), remoteUrl: created.link ?? base };
}

/** Connect-time validation: users/me proves the app password, root gives the site name. */
export async function wordpressValidate(
  site: string,
  username: string,
  appPassword: string,
): Promise<{ userId: string; siteName: string }> {
  const base = siteBase(site);
  const auth = authHeader(username, appPassword);
  let me: { id: number; slug?: string };
  try {
    me = await wp<{ id: number; slug?: string }>(base, auth, '/wp/v2/users/me');
  } catch (e) {
    throw new Error(
      `WordPress rejected those credentials: ${e instanceof Error ? e.message : 'unknown error'}. ` +
        'Check Users → Profile → Application Passwords (WP 5.6+) and that the REST API is reachable.',
    );
  }
  let siteName = base.replace(/^https?:\/\//i, '');
  try {
    const root = await wp<{ name?: string }>(base, auth, '/');
    if (root.name) siteName = root.name;
  } catch {
    /* display-only */
  }
  return { userId: String(me.id), siteName };
}
