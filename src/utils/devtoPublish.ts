/**
 * Native Dev.to publishing (API key). Mirrors apps/worker/src/devto.ts:
 * title + markdown body as a published article. Tags cap at 4 (comma
 * string); covers need public URLs so v1 sends none (documented omission).
 */

const API = 'https://dev.to/api';
const TAGS_MAX = 4;

function cleanTags(raw: unknown): string | undefined {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const tags = list
    .map((t) => String(t).trim().toLowerCase().replace(/\s+/g, ''))
    .filter(Boolean)
    .slice(0, TAGS_MAX);
  return tags.length ? tags.join(', ') : undefined;
}

/**
 * Publish an article. Returns the Dev.to article id for the queue.
 * Title falls back to the first line when the composer sends none.
 */
export async function publishDevto(opts: {
  apiKey: string;
  title: string;
  text: string;
  tags?: string[];
}): Promise<string> {
  const { apiKey } = opts;
  if (!apiKey) throw new Error('Dev.to not connected');
  const text = (opts.text ?? '').trim();
  if (!text) throw new Error('Dev.to needs article text — this post is empty.');
  const title = (opts.title ?? '').trim() || text.split('\n')[0].slice(0, 120);
  const article: Record<string, unknown> = {
    title,
    body_markdown: text,
    published: true,
    description: text.slice(0, 150),
  };
  const tags = cleanTags(opts.tags);
  if (tags) article.tags = tags;
  const res = await fetch(`${API}/articles`, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ article }),
  });
  const json = (await res.json().catch(() => null)) as { id?: number; url?: string; error?: string } | null;
  if (!res.ok || !json?.id) {
    const detail = typeof json?.error === 'string' && json.error ? json.error : `HTTP ${res.status}`;
    throw new Error(`Dev.to refused the article: ${detail}`);
  }
  return String(json.id);
}
