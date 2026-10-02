// connect-telegram · Bot API connect (Phase 1 integration #1)
//
// Telegram has no OAuth: the user creates a bot with @BotFather and pastes
// the token. This function validates the token with getMe, validates the
// destination with getChat (Telegram itself errors when the bot cannot see
// the chat), then stores the channel through the existing import path.
//
// POST { workspace_id, bot_token, chat_id }
// → 200 { ok: true, channel_id, title } · 400 bad body · 401 · 403 · 500

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API = "https://api.telegram.org";

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status });
}

interface BotResult<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function callBot<T>(token: string, method: string, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => null)) as BotResult<T> | null;
  if (!json || json.ok !== true) {
    throw new Error(json?.description ?? `Telegram returned HTTP ${res.status}`);
  }
  return json.result as T;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !anonKey || !serviceKey) return bad("Function misconfigured — missing Supabase env.", 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return bad("Sign in first.", 401);
  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: ud, error: uErr } = await userClient.auth.getUser();
  const user = ud?.user;
  if (uErr || !user) return bad("Sign in first.", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Body must be JSON.");
  }
  const workspace_id = body["workspace_id"];
  const bot_token = body["bot_token"];
  const chat_id = body["chat_id"];
  if (typeof workspace_id !== "string" || !workspace_id) return bad("workspace_id required.");
  if (typeof bot_token !== "string" || !bot_token.trim()) return bad("Bot token required.");
  if (typeof chat_id !== "string" || !chat_id.trim()) return bad("Destination chat required.");

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // Role gate — same rule as every other connect path.
  const { data: member } = await admin
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = (member as { role?: string; status?: string } | null)?.role;
  if (!member || member.status !== "active" || (role !== "owner" && role !== "admin")) {
    return bad("Only workspace owners and admins can connect channels.", 403);
  }

  const token = bot_token.trim();
  const target = chat_id.trim();

  // Validate token + destination against Telegram before storing anything.
  let bot: { username?: string; first_name?: string; id: number };
  let chat: { id: number; title?: string; username?: string; type: string; photo?: { small_file_id?: string } };
  try {
    bot = await callBot<{ username?: string; first_name?: string; id: number }>(token, "getMe", {});
    chat = await callBot<{ id: number; title?: string; username?: string; type: string; photo?: { small_file_id?: string } }>(
      token,
      "getChat",
      { chat_id: target },
    );
  } catch (e) {
    return bad(
      `Telegram rejected that bot or destination: ${e instanceof Error ? e.message : "unknown error"}. ` +
        "Add the bot to the channel/group first, then paste the numeric chat id or @username.",
    );
  }

  const resolvedId = String(chat.id);
  const title = chat.title ?? chat.username ?? resolvedId;

  // Chat photo, best-effort: getChat yields a file id, getFile resolves it.
  // Missing/failed photos must never fail the connect.
  let avatar: string | undefined;
  try {
    const fileId = chat.photo?.small_file_id;
    if (fileId) {
      const file = await callBot<{ file_path?: string }>(token, "getFile", { file_id: fileId });
      if (file?.file_path) avatar = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    }
  } catch {
    /* photo-less chats keep the brand disc */
  }

  // Store through the existing import path (Vault + connected_channels).
  const importRes = await fetch(`${supaUrl}/functions/v1/import-channel-token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      workspace_id,
      provider: "telegram",
      external_id: resolvedId,
      display_name: title,
      handle: chat.username ? `@${chat.username}` : (bot.username ? `@${bot.username}` : null),
      metadata: {
        chatType: chat.type,
        username: chat.username ?? "",
        botUsername: bot.username ?? "",
        ...(avatar ? { avatar } : {}),
      },
      access_token: token,
      token_type: "Bot",
      scopes: [],
    }),
  });
  const importJson = (await importRes.json().catch(() => ({}))) as { channel_id?: string; error?: string };
  if (!importRes.ok || !importJson.channel_id) {
    return bad(importJson.error ?? "Could not save the Telegram channel.", 500);
  }

  return Response.json({ ok: true, channel_id: importJson.channel_id, title });
});
