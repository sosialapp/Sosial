/**
 * VK community validation (device-side, community access key).
 *
 * VK retired user-OAuth token flows in 2024 and gates user-wall posting, so
 * Sosial posts to owned communities/pages only: the admin mints an
 * unlimited community access key (Community → Manage → Working with API →
 * Access Tokens, wall + photos rights). Accepts a numeric id, short name,
 * or full vk.com link; validates with groups.getById.
 */

const API = 'https://api.vk.com/method';
const V = '5.131';

interface VkEnvelope<T> {
  response?: T;
  error?: { error_code?: number; error_msg?: string };
}

async function vk<T>(token: string, method: string, params: Record<string, string>): Promise<T> {
  const body = new URLSearchParams({ access_token: token, v: V, ...params });
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => null)) as VkEnvelope<T> | null;
  const err = json?.error?.error_msg;
  if (!res.ok || !json || err || json.response === undefined) {
    throw new Error(err ?? `HTTP ${res.status}`);
  }
  return json.response as T;
}

export interface VkIdentity {
  groupId: string;
  groupName: string;
  screenName: string;
}

export async function validateVk(accessToken: string, community: string): Promise<VkIdentity> {
  const key = accessToken.trim();
  if (!key) throw new Error('Paste the community access key first.');
  const raw = community.trim();
  if (!raw) throw new Error('Enter the community link, short name or numeric id first.');
  const urlMatch = raw.match(/vk\.com\/([A-Za-z0-9_.]+)/i);
  const ident = urlMatch?.[1] ?? raw;
  let numeric: string | null = null;
  if (/^(club|public)\d+$/i.test(ident)) numeric = ident.replace(/^\D+/i, '');
  else if (/^\d+$/.test(ident)) numeric = ident;
  else {
    try {
      const resolved = await vk<{ type?: string; object_id?: number }[] | { type?: string; object_id?: number }>(
        key,
        'utils.resolveScreenName',
        { screen_name: ident.replace(/^@/, '') },
      );
      const hit = Array.isArray(resolved) ? resolved[0] : resolved;
      if (hit?.type === 'group' && hit.object_id) numeric = String(hit.object_id);
    } catch {
      /* surfaced below as not-found */
    }
  }
  if (!numeric) {
    throw new Error(
      'VK could not find that community. Use its numeric id (club123 → 123), short name, or full vk.com link.',
    );
  }
  try {
    const got = await vk<
      | { id: number; name: string; screen_name?: string }[]
      | { items?: { id: number; name: string; screen_name?: string }[] }
    >(key, 'groups.getById', { group_id: numeric });
    const list = Array.isArray(got) ? got : (got.items ?? []);
    const g = list[0];
    if (!g?.id) throw new Error('not found');
    return {
      groupId: String(g.id),
      groupName: g.name || `Community ${g.id}`,
      screenName: g.screen_name || '',
    };
  } catch (e) {
    throw new Error(
      `VK rejected those credentials: ${e instanceof Error ? e.message : 'unknown error'}. ` +
        'Check the community access key (Manage → Working with API → Access Tokens, wall + photos rights) and that the key belongs to this community.',
    );
  }
}
