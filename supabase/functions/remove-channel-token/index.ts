// remove-channel-token · cloud opt-out / disconnect cleanup
//
// Auth model: caller JWT → active membership check → OWNER/ADMIN check (only
// owners and admins may disconnect a connected account) → act on the channel.
// Idempotent: unknown channel → 200 { removed: false }.
//
// POST { workspace_id, provider, external_id?, mode?, dry_run? }
// Without external_id, acts on ALL rows of that provider in the workspace
// (cleanup path when device tokens are already gone).
//
// mode 'revoke' (default) REVOKES: the row keeps status='revoked' so post cards
// and analytics keep their destination while publishing and every cron only
// look at status='connected'. import-channel-token upserts on workspace+
// provider+external id, so reconnecting revives the same row and its posts.
// This is the safe path for repairing a channel (expired token, new scopes).
//
// mode 'purge' FORGETS the account: purge_channel_data() removes the channel
// row, its destinations, stats, comments, messages, queue jobs and Vault
// secrets in one transaction, so the workspace looks as if the account was
// never connected. Media and posts with another destination survive.
//
// dry_run: true runs no writes and returns the exact counts a purge would
// remove, for the confirmation dialog.
// → 200 { removed: boolean, purged?: boolean, counts?: Counts }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROVIDERS = new Set([
  "facebook", "instagram", "threads", "tiktok", "x",
  "bluesky", "linkedin", "mastodon", "pinterest", "youtube",
  "telegram", "discord", "wordpress", "devto", "hashnode", "ghost", "vk", "gmb",
]);

// Browser preflight must pass before supabase-js can POST at all.
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

// Shape returned to the confirmation dialog; kept in sync with
// public.channel_purge_counts().
const COUNT_KEYS = [
  "targets", "scheduled", "posts", "comments", "messages", "conversations", "stats",
] as const;
type Counts = Record<(typeof COUNT_KEYS)[number], number>;

function zeroCounts(): Counts {
  return { targets: 0, scheduled: 0, posts: 0, comments: 0, messages: 0, conversations: 0, stats: 0 };
}

function addCounts(acc: Counts, data: unknown): void {
  if (!data || typeof data !== "object") return;
  for (const k of COUNT_KEYS) {
    const v = (data as Record<string, unknown>)[k];
    if (typeof v === "number") acc[k] += v;
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  // Env fallbacks: newer projects inject SB_* instead of SUPABASE_*.
  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !anonKey || !serviceKey) {
    return bad("Function misconfigured, missing Supabase env.", 500);
  }

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
  const provider = body["provider"];
  const external_id =
    typeof body["external_id"] === "string" && body["external_id"] ? body["external_id"] : null;
  const mode = body["mode"] === "purge" ? "purge" : "revoke";
  const dryRun = body["dry_run"] === true;
  if (typeof workspace_id !== "string" || !workspace_id) return bad("workspace_id required.");
  if (typeof provider !== "string" || !PROVIDERS.has(provider)) return bad("Unknown provider.");

  const admin = createClient(supaUrl, serviceKey);

  const { data: mem } = await admin
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspace_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!mem) return bad("Not a member of this workspace.", 403);
  // Rule: owners and admins may disconnect/remove a connected account.
  const role = (mem as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "admin") {
    return bad("Only owners and admins can disconnect a connected account.", 403);
  }

  let query = admin
    .from("connected_channels")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("provider", provider);
  if (external_id) query = query.eq("external_id", external_id);
  const { data: rows } = await query;
  if (!rows || rows.length === 0) return Response.json({ removed: false }, { headers: CORS });

  const ids = rows.map((r: { id: string }) => r.id);

  // Preview for the confirmation dialog: exact counts, no writes.
  if (dryRun) {
    const counts = zeroCounts();
    for (const id of ids) {
      const { data, error } = await admin.rpc("channel_purge_counts", { p_channel: id });
      if (error) return bad(`Could not read the account data: ${error.message}`, 500);
      addCounts(counts, data);
    }
    return Response.json({ removed: false, counts }, { headers: CORS });
  }

  // Forget the account entirely: one transaction per channel row.
  if (mode === "purge") {
    const counts = zeroCounts();
    let any = false;
    for (const id of ids) {
      const { data, error } = await admin.rpc("purge_channel_data", {
        p_channel: id,
        p_workspace: workspace_id,
      });
      if (error) return bad(`Could not delete the account data: ${error.message}`, 500);
      if (data && typeof data === "object" && (data as { removed?: unknown }).removed === true) {
        any = true;
      }
      addCounts(counts, data);
    }
    return Response.json({ removed: any, purged: true, counts }, { headers: CORS });
  }

  // Default: revoke. Collect secret ids BEFORE the token row is dropped.
  const { data: toks } = await admin
    .from("channel_tokens")
    .select("access_token_secret_id, refresh_token_secret_id")
    .in("channel_id", ids);

  // Revoke, never delete: post history and analytics rows hang off this id and
  // the FK cascades on delete. Token row goes so nothing can publish.
  const { error: rErr } = await admin
    .from("connected_channels")
    .update({
      status: "revoked",
      last_error: "Disconnected. Reconnect this account to publish again.",
    })
    .in("id", ids);
  if (rErr) return bad(`Could not disconnect: ${rErr.message}`, 500);

  await admin.from("channel_tokens").delete().in("channel_id", ids);

  const secrets = (toks ?? []).flatMap((t: Record<string, unknown>) => [
    t.access_token_secret_id,
    t.refresh_token_secret_id,
  ]).filter((s): s is string => typeof s === "string" && !!s);
  for (const sid of new Set(secrets)) {
    await admin.rpc("vault_delete_secret", { secret_id: sid });
  }

  return Response.json({ removed: true }, { headers: CORS });
});
