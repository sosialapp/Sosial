// send-notification · owner broadcast trigger (app admins only)
//
// POST { title, body, kind?, platforms? } → 200 { queued, announcement_id, audience }
//                                             · 400 · 401 · 403
//
// One authored row, two audiences:
//   · the bell   → an `announcements` row every signed-in user can read,
//                  filtered to the platforms they are reading on.
//   · devices    → one send_push job the worker fans out over the Expo Push
//                  API, narrowed to the selected platforms (web has no push).
//
// kind ∈ update | policy | bug | announcement · platforms ⊆ web/ios/android,
// non-empty (omitted → everyone). The worker owns delivery and dead-token
// pruning; this endpoint only validates the admin and writes + queues.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Browser preflight must pass before supabase-js can POST at all.
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

const KINDS = ["update", "policy", "bug", "announcement"] as const;
const PLATFORMS = ["web", "ios", "android"] as const;
const PUSH_PLATFORMS = ["ios", "android"] as const;

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !anonKey || !serviceKey) {
    return bad("Function misconfigured, missing Supabase env.", 500);
  }

  // Caller identity from their own JWT (never trust a body user_id).
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return bad("Sign in first.", 401);
  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: ud, error: uErr } = await userClient.auth.getUser();
  if (uErr || !ud?.user) return bad("Sign in first.", 401);

  // Global admin gate (P11): SECURITY DEFINER reads app_admins, but
  // auth.uid() comes from the caller's JWT, so this is a real check.
  const { data: admin, error: aErr } = await userClient.rpc("is_app_admin");
  if (aErr || admin !== true) return bad("Owner console only.", 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Body must be JSON.");
  }
  const title = typeof body["title"] === "string" ? body["title"].trim() : "";
  const message = typeof body["body"] === "string" ? body["body"].trim() : "";
  if (!title || !message) return bad("title and body required.");
  if (title.length > 120 || message.length > 500) {
    return bad("title ≤ 120 chars, body ≤ 500 chars.");
  }

  const kind = typeof body["kind"] === "string" ? body["kind"] : "announcement";
  if (!KINDS.includes(kind as (typeof KINDS)[number])) {
    return bad(`kind must be one of ${KINDS.join(", ")}.`);
  }

  // platforms omitted → everyone. Otherwise a non-empty subset of the known set.
  const rawPlatforms = body["platforms"];
  let platforms: string[];
  if (rawPlatforms === undefined || rawPlatforms === null) {
    platforms = [...PLATFORMS];
  } else if (
    Array.isArray(rawPlatforms) &&
    rawPlatforms.length > 0 &&
    rawPlatforms.every(
      (p) => typeof p === "string" && PLATFORMS.includes(p as (typeof PLATFORMS)[number]),
    )
  ) {
    platforms = [...new Set(rawPlatforms as string[])];
  } else {
    return bad(`platforms must be a non-empty subset of ${PLATFORMS.join(", ")}.`);
  }

  const adminClient = createClient(supaUrl, serviceKey);

  // The bell row: every signed-in user sees it, filtered to their platform.
  const { data: ann, error: annErr } = await adminClient
    .from("announcements")
    .insert({
      kind,
      title,
      body: message,
      href: typeof body["href"] === "string" && body["href"].trim() ? body["href"].trim() : null,
      platforms,
      created_by: ud.user.id,
    })
    .select("id")
    .single();
  if (annErr || !ann) return bad(`Could not save the announcement (${annErr?.message}).`, 500);

  // Device fan-out only covers ios/android; web is bell-only by design.
  const pushPlatforms = platforms.filter((p) =>
    PUSH_PLATFORMS.includes(p as (typeof PUSH_PLATFORMS)[number])
  );
  let audience = 0;
  if (pushPlatforms.length > 0) {
    const { count } = await adminClient
      .from("push_tokens")
      .select("id", { count: "exact", head: true })
      .in("platform", pushPlatforms);
    audience = count ?? 0;

    // Fresh idempotency key per send: broadcasts are never deduped.
    const { error: qErr } = await adminClient.from("job_queue").upsert(
      {
        kind: "send_push",
        payload: { title, body: message, platforms, announcement_id: ann.id },
        run_at: new Date().toISOString(),
        idempotency_key: `send_push:${ann.id}`,
      },
      { onConflict: "idempotency_key" },
    );
    if (qErr) return bad(`Could not queue the push (${qErr.message}).`, 500);
  }

  return Response.json(
    {
      queued: pushPlatforms.length > 0,
      announcement_id: ann.id,
      audience,
      platforms,
    },
    { headers: CORS },
  );
});
