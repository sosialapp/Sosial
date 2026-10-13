// report-cleanup · daily cron: purge solved support tickets after 30 days.
//
// Tickets marked resolved/closed are deleted 30 days after their last
// update, along with every attachment in the report-media bucket that
// belongs to them (paths are report-media/<user_id>/<file>, and the ticket
// row carries the exact storage names in `attachments`).
// Auth: same shared token as dormancy-sweep (DORMANCY_TOKEN secret).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AFTER_DAYS = 30;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

async function removeStoragePrefix(admin: any, bucket: string, prefix: string): Promise<void> {
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
    for (const d of dirs) await removeStoragePrefix(admin, bucket, d);
    if (files.length > 0) await admin.storage.from(bucket).remove(files);
    if (data.length < 100) break;
    if (dirs.length === 0) offset = 0;
    else offset += 100;
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !serviceKey) return bad("Function misconfigured.", 500);

  const dormancyToken = Deno.env.get("DORMANCY_TOKEN") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  if (!dormancyToken || auth !== `Bearer ${dormancyToken}`) return bad("Unauthorized.", 401);

  const admin = createClient(supaUrl, serviceKey);
  const cutoff = new Date(Date.now() - AFTER_DAYS * 24 * 3600 * 1000).toISOString();

  const { data: rows, error } = await admin
    .from("reports")
    .select("id, user_id, attachments")
    .in("status", ["resolved", "closed"])
    .lt("updated_at", cutoff);
  if (error) return bad(error.message, 500);

  let purged = 0;
  const errors: string[] = [];
  for (const row of (rows ?? []) as { id: string; user_id: string; attachments: unknown }[]) {
    // Delete the attachment objects named on the ticket first.
    const names = Array.isArray(row.attachments) ? row.attachments : [];
    for (const n of names) {
      if (typeof n === "string" && n) {
        const { error: rmErr } = await admin.storage.from("report-media").remove([n]);
        if (rmErr) errors.push(`${row.id}: ${rmErr.message}`);
      }
    }
    // Belt-and-braces: sweep any orphaned files under the user's prefix.
    try {
      await removeStoragePrefix(admin, "report-media", row.user_id);
    } catch (e) {
      errors.push(`${row.id}: sweep ${e instanceof Error ? e.message : String(e)}`);
    }
    const { error: delErr } = await admin.from("reports").delete().eq("id", row.id);
    if (delErr) errors.push(`${row.id}: ${delErr.message}`);
    else purged += 1;
  }

  return Response.json({ ok: errors.length === 0, purged, errors }, { headers: CORS });
});
