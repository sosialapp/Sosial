// connect-discord · Bot token connect (Phase 1 integration #2)
//
// Discord has no per-user OAuth here: the user creates an application in the
// Discord Developer Portal, enables the bot, invites it to their server, and
// pastes the token. Staged flow in one function:
//
//   POST { workspace_id, bot_token }                        → { guilds[] }
//   POST { workspace_id, bot_token, guild_id }              → { channels[] }
//   POST { workspace_id, bot_token, guild_id, channel_id }  → { ok, channel_id }
//
// Validation happens against Discord before anything is stored; the final
// stage stores through the existing import path (Vault + connected_channels).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API = "https://discord.com/api/v10";

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status });
}

async function callDiscord<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bot ${token}` } });
  if (res.status === 429) {
    const retry = res.headers.get("retry-after") ?? res.headers.get("x-ratelimit-reset-after") ?? "5";
    throw new Error(`Discord rate-limited us — retry in ${Math.ceil(Number(retry))}s.`);
  }
  const json = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok || !json) {
    throw new Error(typeof json?.message === "string" && json.message ? json.message : `Discord returned HTTP ${res.status}`);
  }
  return json;
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
  const guild_id = body["guild_id"];
  const channel_id = body["channel_id"];
  if (typeof workspace_id !== "string" || !workspace_id) return bad("workspace_id required.");
  if (typeof bot_token !== "string" || !bot_token.trim()) return bad("Bot token required.");
  const token = bot_token.trim();

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
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

  // Stage 1: validate the token, list the bot's servers.
  let me: { username?: string };
  try {
    me = await callDiscord<{ username?: string }>(token, "/users/@me");
  } catch (e) {
    return bad(
      `Discord rejected that bot token: ${e instanceof Error ? e.message : "unknown error"}. ` +
        "Check the token in the Developer Portal (Bot → Reset Token if unsure).",
    );
  }

  if (typeof guild_id !== "string" || !guild_id) {
    try {
      const guilds = await callDiscord<{ id: string; name: string }[]>(token, "/users/@me/guilds");
      return Response.json({ guilds: (guilds ?? []).map((g) => ({ id: g.id, name: g.name })) });
    } catch (e) {
      return bad(`Could not list servers: ${e instanceof Error ? e.message : "unknown error"}.`);
    }
  }

  // Stage 2: list text channels + active threads in the chosen server.
  // Active-only is deliberate: archived threads reject new messages, so
  // offering them would schedule into a dead end.
  if (typeof channel_id !== "string" || !channel_id) {
    try {
      const [channels, active] = await Promise.all([
        callDiscord<{ id: string; name: string; type: number }[]>(
          token,
          `/guilds/${guild_id}/channels`,
        ),
        callDiscord<{ threads?: { id: string; name: string; parent_id?: string }[] }>(
          token,
          `/guilds/${guild_id}/threads/active`,
        ).catch(() => ({ threads: [] as { id: string; name: string; parent_id?: string }[] })),
      ]);
      const parents = new Map(
        ((channels ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
      );
      const text = ((channels ?? []) as { id: string; name: string; type: number }[])
        .filter((c) => c.type === 0 || c.type === 5)
        .map((c) => ({ id: c.id, name: c.name }));
      const threads = (((active as { threads?: unknown }).threads ?? []) as {
        id: string;
        name: string;
        parent_id?: string;
      }[])
        .filter((t) => t && typeof t.id === "string")
        .map((t) => ({
          id: t.id,
          name: String(t.name ?? "thread"),
          parent_id: typeof t.parent_id === "string" ? t.parent_id : "",
          parent_name: parents.get(typeof t.parent_id === "string" ? t.parent_id : "") ?? "",
        }));
      return Response.json({ channels: text, threads });
    } catch (e) {
      return bad(
        `Could not list channels: ${e instanceof Error ? e.message : "unknown error"}. ` +
          "The bot must be a member of that server.",
      );
    }
  }

  // Stage 3: validate the channel (or thread — /channels/{id} resolves both),
  // then store through the import path. Publishing posts to the stored id,
  // which Discord accepts for threads unchanged.
  let channel: { id: string; name: string; guild_id?: string; parent_id?: string; thread_metadata?: unknown };
  try {
    channel = await callDiscord<{ id: string; name: string; guild_id?: string; parent_id?: string; thread_metadata?: unknown }>(
      token,
      `/channels/${channel_id}`,
    );
  } catch (e) {
    return bad(
      `Discord rejected that channel: ${e instanceof Error ? e.message : "unknown error"}. ` +
        "The bot needs access to post there.",
    );
  }

  // Threads show as `#parent › thread` so the destination is unambiguous.
  let destName = `#${channel.name}`;
  if (channel.thread_metadata !== undefined || channel.parent_id) {
    try {
      const all = await callDiscord<{ id: string; name: string }[]>(token, `/guilds/${guild_id}/channels`);
      const parent = (all ?? []).find((c) => c.id === channel.parent_id);
      destName = `#${parent?.name ?? "thread"} › ${channel.name}`;
    } catch {
      /* best-effort label only */
    }
  }

  let guildName = "";
  try {
    const guilds = await callDiscord<{ id: string; name: string }[]>(token, "/users/@me/guilds");
    guildName = (guilds ?? []).find((g) => g.id === guild_id)?.name ?? "";
  } catch {
    /* display-only */
  }

  const importRes = await fetch(`${supaUrl}/functions/v1/import-channel-token`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      workspace_id,
      provider: "discord",
      external_id: channel.id,
      display_name: destName,
      handle: guildName || (me.username ? `@${me.username}` : null),
      metadata: {
        guildId: guild_id,
        guildName,
        channelName: channel.name,
        botUsername: me.username ?? "",
      },
      access_token: token,
      token_type: "Bot",
      scopes: [],
    }),
  });
  const importJson = (await importRes.json().catch(() => ({}))) as { channel_id?: string; error?: string };
  if (!importRes.ok || !importJson.channel_id) {
    return bad(importJson.error ?? "Could not save the Discord channel.", 500);
  }

  return Response.json({ ok: true, channel_id: importJson.channel_id, title: destName });
});
