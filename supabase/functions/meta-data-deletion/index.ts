// meta-data-deletion · Meta "Data Deletion Request URL" (Threads, Instagram, Facebook).
//
// Same unauthenticated signed_request as meta-deauthorize, same identity
// (app-scoped user_id, resolved by _shared/metaChannels.ts). The
// difference is intent: the user asked for their data to be erased, so a
// revoked row is not enough -- it must be forgotten.
//
// purge_channel_data(p_channel, p_workspace) is the already-audited erasure
// path (p104): channel row, destinations, stats, comments, conversations,
// queue jobs and Vault secrets all go in one transaction, while the files stay
// in the media library and posts with another destination survive. That is the
// most we can honestly delete from a signature alone.
//
// What this deliberately does NOT do: delete the person's Sosial account or
// workspace. A Meta user id does not identify a Sosial login, and no
// unauthenticated callback should be able to erase an account -- or a
// teammate's data -- on a signature. Erasing the Sosial account stays a
// self-serve, signed-in action (delete-account).
//
// Meta requires the reply shape { url, confirmation_code } and retries
// anything not 2xx; the purge is idempotent, so a retry removes 0 rows and
// returns a fresh code.
//
// Configure as https://db.sosial.app/functions/v1/meta-data-deletion
// → 200 { url, confirmation_code } | 400 bad signature | 405 non-POST

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signedRequestField, verifySignedRequest } from "../_shared/signedRequest.ts";
import { metaChannelsForUser, type MetaChannel } from "../_shared/metaChannels.ts";

// Where Meta tells the user to check on the request; a real page on our site.
const STATUS_URL = "https://sosial.app/delete-data";

function bad(msg: string, status = 400): Response {
  return new Response(msg, { status, headers: { "Content-Type": "text/plain" } });
}

function confirmationCode(): string {
  return crypto.randomUUID().replace(/-/g, "").toUpperCase();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !serviceKey) return bad("Function misconfigured.", 500);

  const secrets = [
    Deno.env.get("THREADS_APP_SECRET") ?? "",
    Deno.env.get("META_APP_SECRET") ?? "",
    Deno.env.get("IG_APP_SECRET") ?? "",
  ].filter((s) => s.length > 0);
  if (!secrets.length) return bad("Function misconfigured.", 500);

  const signed = await verifySignedRequest(await signedRequestField(req), secrets);
  if (!signed) return bad("bad signature", 400);

  const code = confirmationCode();
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  let channels: MetaChannel[];
  try {
    channels = await metaChannelsForUser(admin, signed.userId);
  } catch (e) {
    return bad(`Could not read the account: ${(e as Error).message}`, 500);
  }
  let purged = 0;
  for (const c of channels) {
    const { data, error } = await admin.rpc("purge_channel_data", {
      p_channel: c.id,
      p_workspace: c.workspace_id,
    });
    if (error) return bad(`Could not delete the account data: ${error.message}`, 500);
    if (data && typeof data === "object" && (data as { removed?: unknown }).removed === true) {
      purged += 1;
    }
  }

  // No table for these: the code is shown back to the user by Meta and this log
  // line is the record of the request (grep it in the edge-function logs).
  console.log(
    `meta-data-deletion: ${code} — user ${signed.userId}, purged ${purged}/${channels.length} channel(s)`,
  );

  return Response.json({ url: STATUS_URL, confirmation_code: code });
});