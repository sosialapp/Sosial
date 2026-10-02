/**
 * Dev.to API key validation for connect (device-side, mirrors the
 * connect-devto edge function: /users/me proves the key and names the
 * account, including its stable numeric id used as the cloud identity).
 */

const API = 'https://dev.to/api';

export interface DevtoIdentity {
  userId: string;
  username: string;
  name: string;
  avatar?: string;
}

export async function validateDevto(apiKey: string): Promise<DevtoIdentity> {
  const key = apiKey.trim();
  if (!key) throw new Error('Paste the API key first.');
  let me: { id: number; username?: string; name?: string; profile_image?: string; profile_image_90?: string };
  try {
    const res = await fetch(`${API}/users/me`, { headers: { 'api-key': key } });
    const json = (await res.json().catch(() => null)) as
      | (typeof me & { error?: string })
      | null;
    if (!res.ok || !json || !json.id) {
      throw new Error(
        typeof json?.error === 'string' && json.error ? json.error : `HTTP ${res.status}`,
      );
    }
    me = json;
  } catch (e) {
    throw new Error(
      `Dev.to rejected that API key: ${e instanceof Error ? e.message : 'unknown error'}. ` +
        'Mint one at dev.to → Settings → Extensions.',
    );
  }
  return {
    userId: String(me.id),
    username: me.username ?? '',
    name: me.name ?? me.username ?? '',
    avatar: me.profile_image_90 ?? me.profile_image ?? undefined,
  };
}
