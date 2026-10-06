// delete-account · self-serve erasure (Profile → Danger zone, /delete-data)
//
// The caller must be signed in and POST { confirmation: "confirm" } — the
// typed word is re-checked here so the endpoint can never fire by accident.
// What it wipes, in order:
//   1. Pending invites the user sent (their FK would otherwise block the delete)
//   2. Every workspace they OWN, fully: channel Vault secrets, post-media
//      storage objects, then the workspace row (posts, targets, stats,
//      channels, tokens, members, subscriptions, api keys, library, usage…)
//      all cascade from it
//   3. Their memberships in workspaces owned by others (grants cascade)
//   4. Their user-scoped media-integration Vault secrets + rows
//   5. The auth user itself (cascades profile, push tokens, reports)
// Blocks with 409 while an owned workspace still has a live Stripe
// subscription — billing must be cancelled first so nobody pays for a
// deleted account. Multi-member owned workspaces are deleted whole; the UI
// warns about this before the typed confirmation.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

async function removeStoragePrefix(admin: any, bucket: string, prefix: string): Promise<void> {
  // PostgREST storage list pages at 100 rows; walk until a short page.
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error || !data || data.length === 0) break;
    const files: string[] = [];
    const dirs: string[] = [];
    for (const e of data as any[]) {
      if (e.id == null && (e.metadata == null || Object.keys(e.metadata ?? {}).length === 0)) {
        dirs.push(`${prefix}/${e.name}`);
      } else {
        files.push(`${prefix}/${e.name}`);
      }
    }
    // Recurse into subfolders first so the parent listing shrinks.
    for (const d of dirs) await removeStoragePrefix(admin, bucket, d);
    if (files.length > 0) await admin.storage.from(bucket).remove(files);
    if (data.length < 100) break;
    // When only files were removed the listing shifts; restart the page.
    if (dirs.length === 0) offset = 0;
    else offset += 100;
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !anonKey || !serviceKey) return bad("Function misconfigured.", 500);

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
  if (body["confirmation"] !== "confirm") {
    return bad("Type the word “confirm” to delete your data.");
  }

  const admin = createClient(supaUrl, serviceKey);
  const userId = user.id;

  try {
    // 0. Pending invites they sent — the invited_by FK would block user delete.
    await admin.from("invites").delete().eq("invited_by", userId);

    // 1. Owned workspaces, wiped whole.
    const { data: owned } = await admin.from("workspaces").select("id").eq("owner_id", userId);
    for (const ws of (owned ?? []) as { id: string }[]) {
      const wsId = ws.id;

      // Live paid subscription? Stop — cancel billing first.
      const { data: sub } = await admin
        .from("subscriptions")
        .select("status,stripe_subscription_id")
        .eq("workspace_id", wsId)
        .maybeSingle();
      const live =
        sub &&
        ((sub as any).status === "active" || (sub as any).status === "trialing") &&
        (sub as any).stripe_subscription_id;
      if (live) {
        return bad(
          "Cancel your subscription first (Profile → Plan), then delete your data.",
          409,
        );
      }

      // Channel Vault secrets, collected before the cascade eats the rows.
      const { data: channels } = await admin
        .from("connected_channels")
        .select("id")
        .eq("workspace_id", wsId);
      const channelIds = ((channels ?? []) as { id: string }[]).map((c) => c.id);
      if (channelIds.length > 0) {
        const { data: toks } = await admin
          .from("channel_tokens")
          .select("access_token_secret_id,refresh_token_secret_id")
          .in("channel_id", channelIds);
        const secretIds = new Set<string>();
        for (const t of (toks ?? []) as Record<string, unknown>[]) {
          for (const k of ["access_token_secret_id", "refresh_token_secret_id"]) {
            const v = t[k];
            if (typeof v === "string" && v) secretIds.add(v);
          }
        }
        await admin.from("connected_channels").delete().eq("workspace_id", wsId);
        for (const sid of secretIds) {
          await admin.rpc("vault_delete_secret", { secret_id: sid });
        }
      }

      // Uploaded media bytes (rows cascade, bytes do not).
      await removeStoragePrefix(admin, "post-media", wsId);

      // The row itself: posts, targets, stats, members, subscriptions,
      // api keys, library, usage, oauth states… all cascade.
      const { error: wsErr } = await admin.from("workspaces").delete().eq("id", wsId);
      if (wsErr) throw new Error(`Workspace delete failed: ${wsErr.message}`);
    }

    // 2. Memberships in other people's workspaces (grants cascade).
    await admin.from("workspace_members").delete().eq("user_id", userId);

    // 3. User-scoped media-source secrets (rows would cascade; secrets would not).
    const { data: mi } = await admin
      .from("media_integrations")
      .select("access_secret_id,refresh_secret_id")
      .eq("user_id", userId);
    for (const row of (mi ?? []) as Record<string, unknown>[]) {
      for (const k of ["access_secret_id", "refresh_secret_id"]) {
        const v = row[k];
        if (typeof v === "string" && v) await admin.rpc("vault_delete_secret", { secret_id: v });
      }
    }
    await admin.from("media_integrations").delete().eq("user_id", userId);

    // 4. The auth user: cascades profile, remaining memberships,
    // push tokens, reports, oauth states.
    const { error: delErr } = await (admin as any).auth.admin.deleteUser(userId);
    if (delErr) throw new Error(`User delete failed: ${delErr.message}`);

    return Response.json({ ok: true }, { headers: CORS });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Deletion failed.", 500);
  }
});
