/**
 * Discord Bot API validation + server/channel listing for connect
 * (device-side, mirrors the connect-discord edge function stages).
 */

const API = 'https://discord.com/api/v10';

export interface DiscordGuild {
  id: string;
  name: string;
}

export interface DiscordChannel {
  id: string;
  name: string;
}

async function botGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bot ${token}` } });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Discord rejected that bot token — check it in the Developer Portal.');
  }
  const json = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok || !json) {
    const detail = typeof json?.message === 'string' && json.message ? json.message : `HTTP ${res.status}`;
    throw new Error(`Discord: ${detail}`);
  }
  return json;
}

export async function validateDiscordBot(token: string): Promise<{ username: string }> {
  const me = await botGet<{ username?: string }>(token, '/users/@me');
  return { username: me.username ?? 'bot' };
}

export async function listDiscordGuilds(token: string): Promise<DiscordGuild[]> {
  const guilds = await botGet<{ id: string; name: string }[]>(token, '/users/@me/guilds');
  return (Array.isArray(guilds) ? guilds : []).map((g) => ({ id: g.id, name: g.name }));
}

export async function listDiscordChannels(token: string, guildId: string): Promise<DiscordChannel[]> {
  const channels = await botGet<{ id: string; name: string; type: number }[]>(
    token,
    `/guilds/${guildId}/channels`,
  );
  // Text (0) + announcement (5) channels only.
  return (Array.isArray(channels) ? channels : [])
    .filter((c) => c.type === 0 || c.type === 5)
    .map((c) => ({ id: c.id, name: c.name }));
}
