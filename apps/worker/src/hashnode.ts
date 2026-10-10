import { readSecret } from './db';
import { info } from './logger';

/**
 * Hashnode publisher (new GraphQL API, https://gql.hashnode.com).
 *
 * Auth is the Personal Access Token (hashnode.com → Settings → Developer)
 * in the `Authorization` header. Publishing is the publishPost mutation
 * against the connected publication. Covers/tags need public URLs or
 * composer fields, so v1 sends neither (documented omissions, not fakes).
 */

const API = 'https://gql.hashnode.com';

interface Bundle {
  target: { id: string; provider: string; caption: string | null; options: Record<string, unknown> | null; status: string };
  post: { id: string; title: string; body: string };
  media: { storage_path: string; kind: string; mime_type: string | null; position: number }[];
  channel: { id: string; external_id: string; instance_url: string | null; metadata: Record<string, unknown> | null };
  secrets: { access_secret_id: string | null; refresh_secret_id: string | null; expires_at: string | null };
}

interface GraphResult<T> {
  data?: T | null;
  errors?: { message?: string }[];
}

async function gql<T>(pat: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: pat },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json().catch(() => null)) as GraphResult<T> | null;
  const err = json?.errors?.[0]?.message;
  if (!res.ok || err || !json?.data) {
    throw new Error(`Hashnode refused the request: ${err ?? `HTTP ${res.status}`}`);
  }
  return json.data;
}

export async function publishHashnodeTarget(bundle: Bundle): Promise<{ remoteId: string; remoteUrl: string }> {
  const b = bundle;
  if (!b.secrets.access_secret_id) {
    throw new Error('Hashnode token is missing — reconnect the channel in Connect.');
  }
  const pat = await readSecret(b.secrets.access_secret_id);
  if (!pat) {
    throw new Error('Hashnode token is missing — reconnect the channel in Connect.');
  }
  const publicationId = String(b.channel.external_id ?? '').trim();
  if (!publicationId) throw new Error('Hashnode publication is missing — reconnect the channel in Connect.');

  const text = (b.target.caption ?? b.post.body ?? '').trim();
  const art = (b.target.options?.article ?? null) as { html?: string; markdown?: string } | null;
  const articleMarkdown = typeof art?.markdown === 'string' ? art.markdown.trim() : '';
  const body = articleMarkdown || text;
  if (!body) throw new Error('Hashnode needs article text — this post is empty.');
  const title = (b.post.title ?? '').trim() || body.replace(/^#+\s*/, '').split('\n')[0].slice(0, 120);

  const created = await gql<{ publishPost: { post: { id: string; slug: string; url: string } } }>(
    pat,
    `mutation PublishPost($publicationId: ObjectId!, $input: PublishPostInput!) {
      publishPost(publicationId: $publicationId, input: $input) {
        post { id slug url }
      }
    }`,
    {
      publicationId,
      input: { title, contentMarkdown: body },
    },
  );
  const post = created.publishPost?.post;
  if (!post?.id) throw new Error('Hashnode publish failed.');
  info('hashnode post published', { target: b.target.id, post: post.id });
  return { remoteId: post.id, remoteUrl: post.url ?? '' };
}

/** Connect-time validation: me proves the token; publications list the targets. */
export async function hashnodeValidate(pat: string): Promise<{
  userId: string;
  username: string;
  name: string;
  publications: { id: string; title: string; url: string }[];
}> {
  let me: { id: string; username?: string; name?: string };
  try {
    const data = await gql<{ me: { id: string; username?: string; name?: string } }>(
      pat,
      `query Me { me { id username name } }`,
      {},
    );
    me = data.me;
    if (!me?.id) throw new Error('no user');
  } catch (e) {
    throw new Error(
      `Hashnode rejected that token: ${e instanceof Error ? e.message : 'unknown error'}. ` +
        'Generate one at hashnode.com → Settings → Developer.',
    );
  }
  let publications: { id: string; title: string; url: string }[] = [];
  try {
    const data = await gql<{
      user: { publications: { edges: { node: { id: string; title: string; url: string } }[] } } | null;
    }>(
      pat,
      `query MyPubs($username: String!) {
        user(username: $username) {
          publications(first: 10) { edges { node { id title url } } }
        }
      }`,
      { username: me.username ?? '' },
    );
    publications = (data.user?.publications?.edges ?? []).map((e) => e.node).filter((n) => n?.id);
  } catch {
    /* validate-only callers tolerate zero publications */
  }
  return {
    userId: me.id,
    username: me.username ?? '',
    name: me.name ?? me.username ?? '',
    publications,
  };
}
