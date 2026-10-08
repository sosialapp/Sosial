// connect-hashnode · PAT connect, staged (Phase 1 integration #5)
//
// Staged flow in one function (Discord pattern):
//   POST { workspace_id, pat }                    → { publications[] }
//   POST { workspace_id, pat, publication_id }     → { ok, channel_id }
// Validated against gql.hashnode.com before storing anything; the channel
// stores through import-channel-token (Vault + connected_channels).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API = "https://gql.hashnode.com";

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status });
}

async function gql<T>(pat: string, query: string, variables: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: pat },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error("Could not reach Hashnode — check the connection and retry.");
  }
  const text = await res.text().catch(() => "");
  // Since May 2026 Hashnode retired free API access: the endpoint 301s to an
  // announcements page unless the publication is on a Pro plan. Detect the
  // HTML redirect (fetch follows it to a 200) and say so plainly.
  const ct = res.headers.get("content-type") ?? "";
  if (!/json/i.test(ct) || /<!doctype html|<html/i.test(text.slice(0, 200))) {
    throw new Error(
      "Hashnode now requires a Pro plan on your publication for API access. " +
        "Upgrade at your blog dashboard → Billing, then reconnect.",
    );
  }
  let json: { data?: T | null; errors?: { message?: string }[] } | null = null;
  try {
    json = text ? (JSON.parse(text) as typeof json) : null;
  } catch {
    json = null;
  }
  const gqlMsg = (json?.errors ?? [])
    .map((e) => e?.message)
    .filter(Boolean)
    .join(" ")
    .slice(0, 200);
  if (gqlMsg) throw new Error(gqlMsg);
  if (!res.ok) {
    throw new Error(`Hashnode answered HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : " with an empty body"}.`);
  }
  if (!json || !json.data) {
    throw new Error(
      `Hashnode answered 200 with no data${text ? `: ${text.slice(0, 120)}` : " (empty body)"}. ` +
        "The token looks invalid — generate a fresh one at hashnode.com → Settings → Developer.",
    );
  }
  return json.data as T;
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
  const pat = body["pat"];
  const publication_id = body["publication_id"];
  if (typeof workspace_id !== "string" || !workspace_id) return bad("workspace_id required.");
  if (typeof pat !== "string" || !pat.trim()) return bad("Personal access token required.");
  // Strip ALL whitespace — dashboard copy-paste smuggles in line breaks.
  const token = pat.replace(/\s+/g, "");

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

  let me: { id: string; username?: string; name?: string };
  try {
    const data = await gql<{ me: { id: string; username?: string; name?: string } }>(
      token,
      `query Me { me { id username name } }`,
      {},
    );
    me = data.me;
    if (!me?.id) throw new Error("no user");
  } catch (e) {
    return bad(
      `Hashnode rejected that token: ${e instanceof Error ? e.message : "unknown error"}. ` +
        "Generate one at hashnode.com → Settings → Developer.",
    );
  }

  // Stage 1: list publications.
  if (typeof publication_id !== "string" || !publication_id) {
    let publications: { id: string; title: string; url: string }[] = [];
    try {
      const data = await gql<{
        user: { publications: { edges: { node: { id: string; title: string; url: string } }[] } } | null;
      }>(
        token,
        `query MyPubs($username: String!) {
          user(username: $username) {
            publications(first: 10) { edges { node { id title url } } }
          }
        }`,
        { username: me.username ?? "" },
      );
      publications = (data.user?.publications?.edges ?? [])
        .map((e) => e.node)
        .filter((n) => n?.id);
    } catch (e) {
      return bad(`Could not list publications: ${e instanceof Error ? e.message : "unknown error"}.`);
    }
    return Response.json({ publications });
  }

  // Stage 2: save the chosen publication.
  const picked = (
    await gql<{ publication: { id: string; title: string; url: string } | null }>(
      token,
      `query Pub($id: ObjectId!) { publication(id: $id) { id title url } }`,
      { id: publication_id },
    ).catch(() => ({ publication: null }))
  ).publication;
  if (!picked || picked.id !== publication_id) {
    return bad("That publication was not found for this token.");
  }

  const importRes = await fetch(`${supaUrl}/functions/v1/import-channel-token`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: authHeader },
    body: JSON.stringify({
      workspace_id,
      provider: "hashnode",
      external_id: picked.id,
      display_name: picked.title,
      handle: null,
      instance_url: picked.url ?? null,
      metadata: { publicationId: picked.id, publicationTitle: picked.title },
      access_token: token,
      token_type: "PAT",
      scopes: [],
    }),
  });
  const importJson = (await importRes.json().catch(() => ({}))) as { channel_id?: string; error?: string };
  if (!importRes.ok || !importJson.channel_id) {
    return bad(importJson.error ?? "Could not save the Hashnode publication.", 500);
  }

  return Response.json({ ok: true, channel_id: importJson.channel_id, title: picked.title });
});
