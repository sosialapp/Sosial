// marketing-sync ↔ Nightly reconcile: profiles.notif_marketing -> Resend Contacts.
//
// POSTed once a day by pg_cron (net.http_post) at 04:00 UTC with the shared
// marketing_sync_token (private.integration_keys) mirrored as the
// MARKETING_SYNC_TOKEN Supabase secret, same pattern as dormancy-sweep.
// Also safe to trigger manually with the same token.
//
// Uses Resend's current global Contacts API (no audience id) and, when
// RESEND_SEGMENT_ID is set, tags every opt-in with that segment so
// dashboard Broadcasts can target exactly the opted-in crew:
//  1. Every user with notif_marketing = true is upserted into Contacts
//     with unsubscribed: false (per-email idempotent).
//  2. Every contact that is no longer opted in is deleted, so a Settings
//     toggle-off (and never-ticked drift) never leaves anyone on the list.
// Resend env-absence is a clean no-op: {ok: true, skipped} — the toggles
// keep saving and reconciliation completes once RESEND_API_KEY lands.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

type ResendContact = { id: string; email: string; unsubscribed?: boolean };

async function resendList(
  key: string,
  segment: string,
): Promise<ResendContact[]> {
  const out: ResendContact[] = [];
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    let url = "https://api.resend.com/contacts?limit=100";
    if (segment) url += `&segment_id=${segment}`;
    if (after) url += `&after=${after}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) break;
    const j = (await r.json()) as {
      data?: ResendContact[];
      has_more?: boolean;
      next_cursor?: string | null;
    };
    const rows = j.data ?? [];
    out.push(...rows);
    if (j.next_cursor || (j.has_more && rows.length)) after = j.next_cursor ?? rows[rows.length - 1].id;
    else break;
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return bad("POST only.", 405);

  const token = Deno.env.get("MARKETING_SYNC_TOKEN") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  if (!token || auth !== `Bearer ${token}`) return bad("Unauthorized.", 401);

  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resendKey) {
    return Response.json({ ok: true, skipped: "resend_not_configured" }, { headers: CORS });
  }
  const segment = Deno.env.get("RESEND_SEGMENT_ID") ?? "";

  const supa = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { data: optins, error } = await supa.rpc("marketing_optin_emails");
  if (error) return bad(String(error.message), 500);
  const rows = ((optins ?? []) as { user_id: string; email: string }[]).filter((r) => r.email);

  let pushed = 0;
  for (const r of rows) {
    const res = await fetch("https://api.resend.com/contacts", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: r.email,
        unsubscribed: false,
        ...(segment ? { segments: [segment] } : {}),
      }),
    });
    if (res.ok) pushed += 1;
  }

  // Reconcile the other way: a contact no longer in the opted-in set leaves.
  const cancelled = new Set(rows.map((r) => r.email.toLowerCase().trim()));
  const contacts = await resendList(resendKey, segment);
  let revoked = 0;
  for (const c of contacts) {
    if (cancelled.has(c.email.toLowerCase().trim())) continue;
    const del = await fetch(`https://api.resend.com/contacts/${c.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    if (del.ok) revoked += 1;
  }

  return Response.json({ ok: true, opted_in: rows.length, pushed, revoked }, { headers: CORS });
});
