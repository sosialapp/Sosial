// connect-vk · Community access-key connect
//
// VK user-OAuth flows were retired in 2024, so Sosial posts to owned
// communities/pages only: the admin mints an unlimited community access key
// (Community → Manage → Working with API → Access Tokens, wall + photos
// rights). This function resolves the community, validates the key with
// groups.getById, then stores through the existing import path
// (Vault + connected_channels).
//
// POST { workspace_id, access_token, community }
// → 200 { ok, channel_id, title }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API = "https://api.vk.com/method";
const V = "5.131";

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status });
}

interface VkEnvelope<T> {
  response?: T;
  error?: { error_code?: number; error_msg?: string };
}

async function vk<T>(token: string, method: string, params: Record<string, string>): Promise<T> {
  const body = new URLSearchParams({ access_token: token, v: V, ...params });
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => null)) as VkEnvelope<T> | null;
  const err = json?.error?.error_msg;
  if (!res.ok || !json || err || json.response === undefined) {
    throw new Error(err ?? `HTTP ${res.status}`);
  }
  return json.response as T;
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
  const access_token = body["access_token"];
  const community = body["community"];
  if (typeof workspace_id !== "string" || !workspace_id) return bad("workspace_id required.");
  if (typeof access_token !== "string" || !access_token.trim()) return bad("Access key required.");
  if (typeof community !== "string" || !community.trim()) return bad("Community required.");

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

  const key = (access_token as string).trim();
  const raw = (community as string).trim();
  const urlMatch = raw.match(/vk\.com\/([A-Za-z0-9_.]+)/i);
  const ident = urlMatch?.[1] ?? raw;
  let numeric: string | null = null;
  if (/^(club|public)\d+$/i.test(ident)) numeric = ident.replace(/^\D+/i, "");
  else if (/^\d+$/.test(ident)) numeric = ident;
  else {
    try {
      const resolved = await vk<{ type?: string; object_id?: number }[] | { type?: string; object_id?: number }>(
        key,
        "utils.resolveScreenName",
        { screen_name: ident.replace(/^@/, "") },
      );
      const hit = Array.isArray(resolved) ? resolved[0] : resolved;
      if (hit?.type === "group" && hit.object_id) numeric = String(hit.object_id);
    } catch {
      /* surfaced below as not-found */
    }
  }
  if (!numeric) {
    return bad(
      "VK could not find that community. Use its numeric id (club123 → 123), short name, or full vk.com link.",
    );
  }

  let groupId: string;
  let groupName: string;
  let screenName = "";
  try {
    const got = await vk<
      | { id: number; name: string; screen_name?: string }[]
      | { items?: { id: number; name: string; screen_name?: string }[] }
    >(key, "groups.getById", { group_id: numeric });
    const list = Array.isArray(got) ? got : (got.items ?? []);
    const g = list[0];
    if (!g?.id) throw new Error("not found");
    groupId = String(g.id);
    groupName = g.name || `Community ${g.id}`;
    screenName = g.screen_name || "";
  } catch (e) {
    return bad(
      `VK rejected those credentials: ${e instanceof Error ? e.message : "unknown error"}. ` +
        "Check the community access key (Manage → Working with API → Access Tokens, wall + photos rights) and that the key belongs to this community.",
    );
  }

  const importRes = await fetch(`${supaUrl}/functions/v1/import-channel-token`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      workspace_id,
      provider: "vk",
      external_id: groupId,
      display_name: groupName,
      handle: screenName ? `@${screenName}` : undefined,
      instance_url: screenName ? `https://vk.com/${screenName}` : `https://vk.com/club${groupId}`,
      metadata: { screen_name: screenName },
      access_token: key,
      token_type: "Bearer",
      scopes: ["wall", "photos"],
    }),
  });
  const importJson = (await importRes.json().catch(() => ({}))) as { channel_id?: string; error?: string };
  if (!importRes.ok || !importJson.channel_id) {
    return bad(importJson.error ?? "Could not save the VK community.", 500);
  }

  return Response.json({ ok: true, channel_id: importJson.channel_id, title: groupName });
});
