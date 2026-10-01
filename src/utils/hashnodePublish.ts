/**
 * Native Hashnode publishing (PAT). Mirrors apps/worker/src/hashnode.ts:
 * title + markdown body via the publishPost mutation. Tags/covers need
 * composer fields or public URLs, so v1 sends neither (documented omission).
 */

const API = 'https://gql.hashnode.com';

async function gql<T>(pat: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: pat },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json().catch(() => null)) as {
    data?: T | null;
    errors?: { message?: string }[];
  } | null;
  const err = json?.errors?.[0]?.message;
  if (!res.ok || err || !json?.data) {
    throw new Error(`Hashnode refused the request: ${err ?? `HTTP ${res.status}`}`);
  }
  return json.data as T;
}

/**
 * Publish an article to a publication. Returns the Hashnode post id.
 * Title falls back to the first line when the composer sends none.
 */
export async function publishHashnode(opts: {
  pat: string;
  publicationId: string;
  title: string;
  text: string;
}): Promise<string> {
  const { pat, publicationId } = opts;
  if (!pat || !publicationId) throw new Error('Hashnode not connected');
  const text = (opts.text ?? '').trim();
  if (!text) throw new Error('Hashnode needs article text — this post is empty.');
  const title = (opts.title ?? '').trim() || text.split('\n')[0].slice(0, 120);
  const created = await gql<{ publishPost: { post: { id: string; slug: string; url: string } } }>(
    pat,
    `mutation PublishPost($publicationId: ObjectId!, $input: PublishPostInput!) {
      publishPost(publicationId: $publicationId, input: $input) {
        post { id slug url }
      }
    }`,
    { publicationId, input: { title, contentMarkdown: text } },
  );
  const post = created.publishPost?.post;
  if (!post?.id) throw new Error('Hashnode publish failed.');
  return post.id;
}
