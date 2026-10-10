import { readSecret } from './db';
import { storageSign } from './rest';
import { info } from './logger';

/**
 * Dev.to publisher (Forem API, https://dev.to/api).
 *
 * Verified against the official docs:
 * - Auth is an `api-key` header (key from dev.to → Settings → Extensions).
 * - POST /api/articles { article: { title, body_markdown, published,
 *   series?, main_image?, canonical_url?, description?, tags? } }
 * - tags is a comma-separated string, max 4 (backend rejects more).
 * - published=true at publish time — Sosial's worker owns the clock.
 * - main_image needs an absolute public URL. Our media lives in private
 *   storage, so the worker mints a 7-day signed URL at publish time and
 *   hands that to Forem (which fetches + caches it on creation). Any
 *   failure → text-only publish, never a broken image.
 */

const API = 'https://dev.to/api';
const TAGS_MAX = 4;

interface Bundle {
  target: { id: string; provider: string; caption: string | null; options: Record<string, unknown> | null; status: string };
  post: { id: string; title: string; body: string };
  media: { storage_path: string; kind: string; mime_type: string | null; position: number }[];
  channel: { id: string; external_id: string; instance_url: string | null; metadata: Record<string, unknown> | null };
  secrets: { access_secret_id: string | null; refresh_secret_id: string | null; expires_at: string | null };
}

async function callDev<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'api-key': apiKey, 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: string; errors?: unknown }) | null;
  if (!res.ok || !json) {
    const detail =
      typeof json?.error === 'string' && json.error
        ? json.error
        : `HTTP ${res.status}`;
    throw new Error(`Dev.to refused the request: ${detail}`);
  }
  return json;
}

function cleanTags(raw: unknown): string | undefined {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const tags = list.map((t) => String(t).trim().toLowerCase().replace(/\s+/g, '')).filter(Boolean).slice(0, TAGS_MAX);
  return tags.length ? tags.join(', ') : undefined;
}

export async function publishDevtoTarget(bundle: Bundle): Promise<{ remoteId: string; remoteUrl: string }> {
  const b = bundle;
  if (!b.secrets.access_secret_id) {
    throw new Error('Dev.to API key is missing — reconnect the channel in Connect.');
  }
  const apiKey = await readSecret(b.secrets.access_secret_id);
  if (!apiKey) {
    throw new Error('Dev.to API key is missing — reconnect the channel in Connect.');
  }

  const text = (b.target.caption ?? b.post.body ?? '').trim();
  const art = (b.target.options?.article ?? null) as { html?: string; markdown?: string } | null;
  const articleMarkdown = typeof art?.markdown === 'string' ? art.markdown.trim() : '';
  const body = articleMarkdown || text;
  if (!body) throw new Error('Dev.to needs article text — this post is empty.');
  const title = (b.post.title ?? '').trim() || body.replace(/^#+\s*/, '').split('\n')[0].slice(0, 120);
  const opts = (b.target.options ?? {}) as Record<string, unknown>;
  const article: Record<string, unknown> = {
    title,
    body_markdown: body,
    published: true,
    description: (text || body).slice(0, 150),
  };
  const tags = cleanTags(opts.tags);
  if (tags) article.tags = tags;
  if (typeof opts.series === 'string' && opts.series.trim()) article.series = opts.series.trim();
  if (typeof opts.canonical_url === 'string' && opts.canonical_url.trim()) {
    article.canonical_url = opts.canonical_url.trim();
  }

  // Cover: first attached image, via a week-long signed URL minted now.
  // Forem fetches + caches it at creation; any failure → text-only publish.
  const cover = (b.media ?? []).find((m) => m.kind !== 'video' && m.storage_path);
  if (cover?.storage_path) {
    try {
      article.main_image = await storageSign('post-media', cover.storage_path, 7 * 24 * 3600);
    } catch (e) {
      info('devto cover skipped', { target: b.target.id, reason: e instanceof Error ? e.message : 'sign failed' });
    }
  }

  const created = await callDev<{ id: number; url: string }>(apiKey, '/articles', {
    method: 'POST',
    body: JSON.stringify({ article }),
  });
  info('devto article published', { target: b.target.id, article: created.id });
  return { remoteId: String(created.id), remoteUrl: created.url ?? `https://dev.to` };
}

/** Connect-time validation: /users/me proves the key and names the account. */
export async function devtoValidate(apiKey: string): Promise<{ userId: string; username: string; name: string }> {
  let me: { id: number; username?: string; name?: string };
  try {
    me = await callDev<{ id: number; username?: string; name?: string }>(apiKey, '/users/me');
  } catch (e) {
    throw new Error(
      `Dev.to rejected that API key: ${e instanceof Error ? e.message : 'unknown error'}. ` +
        'Mint one at dev.to → Settings → Extensions.',
    );
  }
  if (!me?.id) throw new Error('Dev.to returned no user — check the API key.');
  return { userId: String(me.id), username: me.username ?? '', name: me.name ?? me.username ?? '' };
}
