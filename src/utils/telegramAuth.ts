/**
 * Telegram Bot API validation for connect (device-side, mirrors the
 * connect-telegram edge function: getMe proves the token, getChat proves
 * the bot can see the destination).
 */

const API = 'https://api.telegram.org';

interface BotResult<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function callBot<T>(token: string, method: string, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => null)) as BotResult<T> | null;
  if (!json || json.ok !== true) {
    throw new Error(json?.description ? `Telegram: ${json.description}` : `Telegram returned HTTP ${res.status}.`);
  }
  return json.result as T;
}

export async function validateTelegramBot(token: string): Promise<{ username: string }> {
  const me = await callBot<{ username?: string; first_name?: string }>(token, 'getMe', {});
  return { username: me.username ?? me.first_name ?? 'bot' };
}

export async function resolveTelegramChat(
  token: string,
  chatId: string,
): Promise<{ id: string; title: string; username: string }> {
  try {
    const chat = await callBot<{ id: number; title?: string; username?: string }>(token, 'getChat', {
      chat_id: chatId.trim(),
    });
    return {
      id: String(chat.id),
      title: chat.title ?? chat.username ?? chatId.trim(),
      username: chat.username ?? '',
    };
  } catch (e: any) {
    throw new Error(
      `${e?.message ?? 'Telegram rejected that destination.'} Add the bot to the channel/group first.`,
    );
  }
}
