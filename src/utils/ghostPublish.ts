/**
 * Native Ghost publishing (Admin API key). Mirrors apps/worker/src/ghost.ts:
 * title + body as paragraph blocks, published, via /posts/?source=html.
 * Feature images need public URLs (private storage expires), newsletters
 * and authors need composer fields — documented v1 omissions.
 */

import { ghostJwt } from './ghostAuth';

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

/**
 * Publish a post. Returns the Ghost post id for the queue.
 * Title falls back to the first line when the composer sends none.
 */
export async function publishGhost(opts: {
  siteUrl: string;
  adminKey: string;
  title: string;
  text: string;
}): Promise<string> {
  const { siteUrl, adminKey } = opts;
  if (!siteUrl || !adminKey) throw new Error('Ghost not connected');
  const text = (opts.text ?? '').trim();
  if (!text) throw new Error('Ghost needs article text — this post is empty.');
  const { title, html } = toHtml(opts.title ?? '', text);
  const token = ghostJwt(adminKey);
  const res = await fetch(`${siteUrl}/ghost/api/admin/posts/?source=html`, {
    method: 'POST',
    headers: { Authorization: `Ghost ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ posts: [{ title, html, status: 'published' }] }),
  });
  const json = (await res.json().catch(() => null)) as {
    posts?: { id: string }[];
    errors?: { message?: string }[];
  } | null;
  const err = json?.errors?.[0]?.message;
  if (!res.ok || err || !json?.posts?.[0]?.id) {
    throw new Error(`Ghost refused the post: ${err ?? `HTTP ${res.status}`}`);
  }
  return json.posts[0].id;
}
