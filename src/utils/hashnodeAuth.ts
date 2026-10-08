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
  let res: Response;
  try {
    res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: pat },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error('Could not reach Hashnode — check your connection.');
  }
  const text = await res.text().catch(() => '');
  let json: { data?: T | null; errors?: { message?: string }[] };
  try {
    json = (text ? JSON.parse(text) : {}) as typeof json;
  } catch {
    json = {};
  }
  const gqlMsg = (json?.errors ?? [])
    .map((e) => e?.message)
    .filter(Boolean)
    .join(' ')
    .slice(0, 200);
  if (gqlMsg) throw new Error(gqlMsg);
  if (!res.ok) {
    throw new Error(`Hashnode answered HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ' with an empty body'}.`);
  }
  if (!json.data) {
    throw new Error(
      `Hashnode answered 200 with no data${text ? `: ${text.slice(0, 120)}` : ' (empty body)'}. ` +
        'The token looks invalid — generate a fresh one at hashnode.com → Settings → Developer.',
    );
  }
  return json.data;
}

export interface HashnodeIdentity {
  userId: string;
  username: string;
  name: string;
  publications: HashnodePublication[];
}

export async function validateHashnode(pat: string): Promise<HashnodeIdentity> {
  // Strip ALL whitespace (copy-paste from the dashboard often smuggles in
  // line breaks, which Hashnode silently rejects with an empty 200).
  const token = pat.replace(/\s+/g, '');
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
