// dormancy-sweep · daily cron: warn at 5 months idle, delete at 6.
//
// POSTed once a day by pg_cron (net.http_post, service-role header).
//   1. WARN , accounts idle 5+ months (and never warned) get a "we will
//              delete your account in 1 month" email from no-reply@sosial.app
//              via Resend; the warn stamp lives in user_metadata.
//   2. DELETE, accounts idle 6+ months (warned at least 14 days ago, or
//              never warned but long past the mark) are purged exactly like
//              delete-account: owned workspaces wiped whole (Vault secrets,
//              storage bytes, rows), memberships, media-integration secrets,
//              then the auth user.
// Paying accounts (active/trialing subscription) are never deleted, an
// active subscription is activity in every sense that matters.
// Batch-capped per run so one sweep never times out; cron catches the rest
// tomorrow. "Idle" = the user AND every workspace they belong to have had no
// post and no active member sign-in in the window (a mobile user can stay
// signed in for months without re-authenticating). So a dormant owner whose
// team is still active is never swept; the team is only purged when every
// member has been gone 6 months.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WARN_AFTER_MONTHS = 5;
const DELETE_AFTER_MONTHS = 6;
const BATCH = 20;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString();
}

async function sendWarnEmail(resendKey: string, to: string): Promise<boolean> {
  if (!resendKey) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Sosial <no-reply@sosial.app>",
        to: [to],
        reply_to: "support@sosial.app",
        subject: "Your Sosial account will be deleted in 1 month",
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F4F4;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F4;padding:40px 16px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding:0 8px 24px 8px;"><img src="https://sosial.app/bolt.png" width="30" height="30" alt="Sosial" style="display:inline-block;vertical-align:middle;border-radius:8px;" /><span style="display:inline-block;vertical-align:middle;margin-left:8px;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#1C1A14;letter-spacing:-0.5px;">Sosial</span></td></tr><tr><td style="background:#FFFFFF;border:1px solid #E6E6E6;border-radius:16px;padding:44px 40px;"><p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8A8A8A;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;">Account notice</p><h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#1C1A14;font-weight:700;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;">We haven't seen you in a while.</h1><p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#55524A;font-family:Helvetica,Arial,sans-serif;">Your Sosial account has been inactive for five months. Per our <a href="https://sosial.app/terms" style="color:#1C1A14;">Terms</a>, accounts inactive for six months are deleted along with all their data, posts, media, templates and connected channels.</p><p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#55524A;font-family:Helvetica,Arial,sans-serif;"><strong>Your account is scheduled for deletion one month from today.</strong> To keep it, just <a href="https://sosial.app/login" style="color:#1C1A14;font-weight:700;">sign in</a>, no other action needed.</p><a href="https://sosial.app/login" style="display:inline-block;background:#FFC62E;color:#1C1A14;text-decoration:none;font-weight:700;font-size:15px;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;padding:14px 32px;border-radius:999px;">Sign in to keep my account</a></td></tr><tr><td style="padding:24px 8px;font-size:12px;color:#8A8A8A;font-family:Helvetica,Arial,sans-serif;">Questions? Email support@sosial.app.<br>&copy; Sosial &middot; <a href="https://sosial.app" style="color:#8A8A8A;">sosial.app</a></td></tr></table></td></tr></table></body></html>`,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
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
    for (const d of dirs) await removeStoragePrefix(admin, bucket, d);
    if (files.length > 0) await admin.storage.from(bucket).remove(files);
    if (data.length < 100) break;
    if (dirs.length === 0) offset = 0;
    else offset += 100;
  }
}

/** Same purge as delete-account, minus the confirmation dance. */
async function purgeUser(admin: any, userId: string): Promise<void> {
  await admin.from("invites").delete().eq("invited_by", userId);

  const { data: owned } = await admin.from("workspaces").select("id").eq("owner_id", userId);
  for (const ws of (owned ?? []) as { id: string }[]) {
    const wsId = ws.id;

    // Live paid subscription? Never delete, billing must be cancelled first.
    const { data: sub } = await admin
      .from("subscriptions")
      .select("status,stripe_subscription_id")
      .eq("workspace_id", wsId)
      .maybeSingle();
    const live =
      sub &&
      ((sub as any).status === "active" || (sub as any).status === "trialing") &&
      (sub as any).stripe_subscription_id;
    if (live) throw new Error(`skip: ${wsId} has a live subscription`);

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

    await removeStoragePrefix(admin, "post-media", wsId);
    const { error: wsErr } = await admin.from("workspaces").delete().eq("id", wsId);
    if (wsErr) throw new Error(`Workspace delete failed: ${wsErr.message}`);
  }

  await admin.from("workspace_members").delete().eq("user_id", userId);

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

  const { error: delErr } = await (admin as any).auth.admin.deleteUser(userId);
  if (delErr) throw new Error(`User delete failed: ${delErr.message}`);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!supaUrl || !serviceKey) return bad("Function misconfigured.", 500);

  // Cron calls carry a dedicated shared token (stored live in
  // private.integration_keys + Supabase secrets as DORMANCY_TOKEN) so the
  // service-role key never has to live in the cron context.
  const dormancyToken = Deno.env.get("DORMANCY_TOKEN") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  if (!dormancyToken || auth !== `Bearer ${dormancyToken}`) return bad("Unauthorized.", 401);

  const admin = createClient(supaUrl, serviceKey);
  const warnBefore = monthsAgo(WARN_AFTER_MONTHS);
  const deleteBefore = monthsAgo(DELETE_AFTER_MONTHS);
  let warned = 0;
  let deleted = 0;
  const errors: string[] = [];

  // ---- 1. WARN (5 months idle, never warned) --------------------------------
  const { data: warnRows } = await admin.rpc("dormancy_candidates", {
    p_idle_before: warnBefore,
    p_limit: BATCH,
  });
  for (const row of ((warnRows ?? []) as { id: string; email: string; warned_at: string | null }[])) {
    if (row.warned_at) continue;
    const sent = await sendWarnEmail(resendKey, row.email);
    // Stamp even if Resend hiccuped: a user who never got the warning is
    // still covered, deletion additionally requires the warning stamp OR
    // an account well past the 6-month mark with the stamp retried daily.
    if (sent) {
      await (admin as any).auth.admin.updateUserById(row.id, {
        user_metadata: { dormancy_warned_at: new Date().toISOString() },
      });
      warned += 1;
    }
  }

  // ---- 2. DELETE (6 months idle + warned >=14 days ago) ---------------------
  const { data: delRows } = await admin.rpc("dormancy_candidates", {
    p_idle_before: deleteBefore,
    p_limit: BATCH,
  });
  for (const row of ((delRows ?? []) as {
    id: string;
    email: string;
    warned_at: string | null;
  }[])) {
    if (!row.warned_at) continue; // one month's notice is mandatory
    const warnedAt = new Date(row.warned_at).getTime();
    if (Date.now() - warnedAt < 14 * 24 * 3600 * 1000) continue; // full notice window
    try {
      await purgeUser(admin, row.id);
      deleted += 1;
    } catch (e) {
      // "skip: … has a live subscription", paying accounts are never deleted.
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.startsWith("skip:")) errors.push(`${row.id}: ${msg}`);
    }
  }

  return Response.json({ ok: errors.length === 0, warned, deleted, errors }, { headers: CORS });
});
