// meta-deauthorize · Threads/Meta "Deauthorize Callback URL".
//
// Meta POSTs an unauthenticated, form-encoded signed_request when a user
// removes the app. The only trustworthy identity in it is user_id (their
// app-scoped id), which is exactly what we store in
// connected_channels.external_id for Threads, so that is the lookup key.
//
// Deauthorize means the user took our access away: the token we hold is
// already void, so this calls for REVOKE, not purge. Revoking (status
// 'revoked', token row and Vault secrets dropped, post history and analytics
// kept) is the same end state as the in-app "disconnect" and it leaves a
// reinstall free to revive the same row -- import-channel-token upserts on
// workspace + provider + external_id.
//
// Meta retries anything that is not 2xx, so every path answers 2xx except a
// missing/invalid signature. Idempotent: a second call finds no connected row.
//
// Configure as https://db.sosial.app/functions/v1/meta-deauthorize
// → 200 { ok: true, revoked: n } | 400 bad signature | 405 non-POST

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signedRequestField, verifySignedRequest } from "../_shared/signedRequest.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function bad(msg: string, status = 400): Response {
  return new Response(msg, { status, headers: { ...CORS, "Content-Type": "text/plain" } });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !serviceKey) return bad("Function misconfigured.", 500);

  // Whichever Meta app the user installed signed this; accepting any of them
  // only proves Meta sent the body, which is all we need.
  const secrets = [
    Deno.env.get("THREADS_APP_SECRET") ?? "",
    Deno.env.get("META_APP_SECRET") ?? "",
    Deno.env.get("IG_APP_SECRET") ?? "",
  ].filter((s) => s.length > 0);
  if (!secrets.length) return bad("Function misconfigured.", 500);

  const signed = await verifySignedRequest(await signedRequestField(req), secrets);
  if (!signed) return bad("bad signature", 400);

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // Threads external_id IS the app-scoped user id Meta sends here. Page and IG
  // account ids never match a user id, so those providers cannot be resolved
  // from this callback and are not queried.
  const { data: rows, error: rowsErr } = await admin
    .from("connected_channels")
    .select("id")
    .eq("provider", "threads")
    .eq("external_id", signed.userId);
  if (rowsErr) return bad(`Could not read the account: ${rowsErr.message}`, 500);

  const ids = ((rows ?? []) as { id: string }[]).map((r) => r.id);
  if (!ids.length) return Response.json({ ok: true, revoked: 0 }, { headers: CORS });

  // Secret ids before the token rows go -- the secrets live outside them.
  const { data: toks } = await admin
    .from("channel_tokens")
    .select("access_token_secret_id, refresh_token_secret_id")
    .in("channel_id", ids);

  // Revoke, never delete: destination rows, comments and analytics hang off the
  // channel id and cascade on delete. Dropping the token row is what stops
  // publishing.
  const { error: updErr } = await admin
    .from("connected_channels")
    .update({
      status: "revoked",
      last_error: "Disconnected. Reconnect this account to publish again.",
    })
    .in("id", ids);
  if (updErr) return bad(`Could not disconnect: ${updErr.message}`, 500);

  await admin.from("channel_tokens").delete().in("channel_id", ids);

  const secretIds = ((toks ?? []) as Record<string, unknown>[])
    .flatMap((t) => [t["access_token_secret_id"], t["refresh_token_secret_id"]])
    .filter((s): s is string => typeof s === "string" && !!s);
  for (const sid of new Set(secretIds)) {
    await admin.rpc("vault_delete_secret", { secret_id: sid });
  }

  console.log(`meta-deauthorize: revoked ${ids.length} channel(s) for user ${signed.userId}`);
  return Response.json({ ok: true, revoked: ids.length }, { headers: CORS });
});