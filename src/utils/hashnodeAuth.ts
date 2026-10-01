/**
 * Hashnode PAT validation + publication listing for connect (device-side,
 * mirrors the connect-hashnode edge function stages against gql.hashnode.com).
 */

const API = 'https://gql.hashnode.com';

export interface HashnodePublication {
  id: string;
  title: string;
  url: string;
}

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
    throw new Error(err ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

export interface HashnodeIdentity {
  userId: string;
  username: string;
  name: string;
  publications: HashnodePublication[];
}

export async function validateHashnode(pat: string): Promise<HashnodeIdentity> {
  const token = pat.trim();
  if (!token) throw new Error('Paste the personal access token first.');
  let me: { id: string; username?: string; name?: string };
  try {
    const data = await gql<{ me: { id: string; username?: string; name?: string } }>(
      token,
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
  let publications: HashnodePublication[] = [];
  try {
    const data = await gql<{
      user: { publications: { edges: { node: HashnodePublication }[] } } | null;
    }>(
      token,
      `query MyPubs($username: String!) {
        user(username: $username) {
          publications(first: 10) { edges { node { id title url } } }
        }
      }`,
      { username: me.username ?? '' },
    );
    publications = (data.user?.publications?.edges ?? [])
      .map((e) => e.node)
      .filter((n) => n?.id);
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
