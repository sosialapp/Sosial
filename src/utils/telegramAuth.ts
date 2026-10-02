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

/** Chat photo URL, best-effort (undefined when the chat has no photo). */
export async function fetchTelegramChatAvatar(
  token: string,
  chatId: string,
): Promise<string | undefined> {
  try {
    const chat = await resolveTelegramChat(token, chatId);
    return chat.avatar;
  } catch {
    return undefined;
  }
}

export async function resolveTelegramChat(
  token: string,
  chatId: string,
): Promise<{ id: string; title: string; username: string; avatar?: string }> {
  try {
    const chat = await callBot<{
      id: number;
      title?: string;
      username?: string;
      photo?: { small_file_id?: string };
    }>(token, 'getChat', {
      chat_id: chatId.trim(),
    });
    // Chat photo, best-effort — photo-less chats keep the brand disc.
    let avatar: string | undefined;
    try {
      const fileId = chat.photo?.small_file_id;
      if (fileId) {
        const file = await callBot<{ file_path?: string }>(token, 'getFile', { file_id: fileId });
        if (file?.file_path) avatar = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      }
    } catch {
      /* no avatar */
    }
    return {
      id: String(chat.id),
      title: chat.title ?? chat.username ?? chatId.trim(),
      username: chat.username ?? '',
      avatar,
    };
  } catch (e: any) {
    throw new Error(
      `${e?.message ?? 'Telegram rejected that destination.'} Add the bot to the channel/group first.`,
    );
  }
}
