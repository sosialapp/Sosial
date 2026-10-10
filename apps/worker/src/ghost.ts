import { createHmac } from 'node:crypto';
import { readSecret } from './db';
import { info } from './logger';

/**
 * Ghost publisher (Admin API JWT, per-site key).
 *
 * Auth is HS256 JWT signed with the Admin API secret: header
 * {alg,kid}, payload {iat,exp,aud:/admin/}, 5-minute expiry. Key format
 * `{id}:{secret}` as issued under Ghost Admin → Integrations.
 * - Validation: GET {site}/ghost/api/admin/site/
 * - Publish: POST {site}/ghost/api/admin/posts/?source=html
 *   {posts:[{title, html, status:published}]} — paragraph blocks.
 * Feature images need public URLs (private storage expires), newsletters
 * and authors need composer fields — all documented v1 omissions.
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
    throw new Error('Ghost site URL must start with http(s) — reconnect the channel.');
  }
  return base;
}

function b64url(input: Buffer | string): string {
  const b = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function ghostJwt(adminKey: string): string {
  const sep = adminKey.indexOf(':');
  if (sep < 1) throw new Error('Ghost Admin API key looks wrong (expected id:secret) — reconnect the channel.');
  const id = adminKey.slice(0, sep);
  const secret = Buffer.from(adminKey.slice(sep + 1), 'hex');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id }));
  const payload = b64url(JSON.stringify({ iat: now, exp: now + 5 * 60, aud: '/admin/' }));
  const sig = b64url(createHmac('sha256', secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

async function ghost<T>(base: string, token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}/ghost/api/admin${path}`, {
    ...init,
    headers: { Authorization: `Ghost ${token}`, ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => null)) as (T & { errors?: { message?: string }[] }) | null;
  const err = json?.errors?.[0]?.message;
  if (!res.ok || err) {
    throw new Error(`Ghost refused the request: ${err ?? `HTTP ${res.status}`}`);
  }
  return json as T;
}

function toHtml(title: string, body: string): { title: string; html: string } {
  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<!-- wp:paragraph --><p>${p.replace(/\n/g, '<br>')}</p><!-- /wp:paragraph -->`);
  return {
    title: title.trim() || paras[0]?.replace(/<[^>]+>/g, '').slice(0, 80) || 'Untitled',
    html: paras.join('\n'),
  };
}

export async function publishGhostTarget(bundle: Bundle): Promise<{ remoteId: string; remoteUrl: string }> {
  const b = bundle;
  const base = siteBase(b.channel.instance_url);
  if (!b.secrets.access_secret_id) {
    throw new Error('Ghost Admin API key is missing — reconnect the channel in Connect.');
  }
  const adminKey = await readSecret(b.secrets.access_secret_id);
  if (!adminKey) {
    throw new Error('Ghost Admin API key is missing — reconnect the channel in Connect.');
  }

  const text = (b.target.caption ?? b.post.body ?? '').trim();
  const art = (b.target.options?.article ?? null) as { html?: string; markdown?: string } | null;
  const articleHtml = typeof art?.html === 'string' ? art.html.trim() : '';
  const { title, html } = articleHtml
    ? { title: (b.post.title ?? '').trim() || 'Untitled', html: articleHtml }
    : toHtml(b.post.title ?? '', text);
  if (!html) throw new Error('Ghost needs article text — this post is empty.');
  const token = ghostJwt(adminKey);
  const created = await ghost<{ posts: { id: string; url: string }[] }>(base, token, '/posts/?source=html', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ posts: [{ title, html, status: 'published' }] }),
  });
  const post = created.posts?.[0];
  if (!post?.id) throw new Error('Ghost publish failed.');
  info('ghost post published', { target: b.target.id, post: post.id });
  return { remoteId: post.id, remoteUrl: post.url ?? base };
}

/** Connect-time validation: site/ proves the key and names the publication. */
export async function ghostValidate(adminKey: string, site: string): Promise<{ siteTitle: string }> {
  const base = siteBase(site);
  const token = ghostJwt(adminKey.trim());
  let title = base.replace(/^https?:\/\//i, '');
  try {
    const data = await ghost<{ site: { title?: string } }>(base, token, '/site/');
    if (data.site?.title) title = data.site.title;
  } catch (e) {
    throw new Error(
      `Ghost rejected those credentials: ${e instanceof Error ? e.message : 'unknown error'}. ` +
        'Check Integrations → your key in Ghost Admin, and that /ghost/api/ is reachable.',
    );
  }
  return { siteTitle: title };
}
