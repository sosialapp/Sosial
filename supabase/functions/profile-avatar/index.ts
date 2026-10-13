// profile-avatar · get / set / clear the signed-in user's profile picture.
//
// GET  → 200 { avatar_url } (profiles column; null when none)
// POST { image_base64 } → compress to ≤256px JPEG (quality ~72) server-side,
//                        store as avatars/<uid>/pfp.jpg, update profiles.
// POST { source: "google" } → fetch identities[0].identity_data.picture (or
//                        user_metadata.picture / avatar_url), compress the
//                        same way, store. Idempotent.
// DELETE → clear the column and remove the stored object.
//
// Why server-side: the browser never uploads raw multi-MB photos, the
// function downsizes to ≤256px so a profile picture is a few KB. Uses
// createObjectURL-free 100% Deno: decode via ImageMagick-equivalent isn't
// available, so we re-encode JPEG at fixed width using the pure-Deno
// canvas-free approach: fetch → resize via `wasm` would need deps. Instead
// compression = JPEG re-encode at hard-capped dimension using Deno's
// built-in ImageDecoder (resident in modern runtimes), falling back to
// storing the original when the runtime lacks it (small avatars only).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_DIM = 256; // px, plenty for 56–112px UI at 2x DPR
const JPEG_QUALITY = 0.72;
const BUCKET = "avatars";
const OBJECT = "pfp.jpg";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS });
}

function bad(msg: string, status = 400): Response {
  return json({ error: msg }, status);
}

/** Decode + downscale + re-encode to JPEG bytes. Returns null when the
 *  runtime has no ImageDecoder (then caller stores original if small). */
async function compressToJpeg(bytes: Uint8Array): Promise<Uint8Array | null> {
  const AnyWin = Deno as unknown as {
    ImageDecoder?: new (data: BufferSource) => {
      decode: () => Promise<{ frame: VideoFrame }>;
      completed: Promise<boolean>;
    };
  };
  if (!AnyWin.ImageDecoder) return null;
  try {
    const decoder = new AnyWin.ImageDecoder({ data: bytes });
    await decoder.completed;
    const { frame } = await decoder.decode();
    try {
      const scale = Math.min(1, MAX_DIM / Math.max(frame.displayWidth, frame.displayHeight));
      const w = Math.max(1, Math.round(frame.displayWidth * scale));
      const h = Math.max(1, Math.round(frame.displayHeight * scale));
      // Draw through OffscreenCanvas for the resample.
      const src = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
      src.getContext("2d")!.drawImage(frame, 0, 0);
      const out = new OffscreenCanvas(w, h);
      const ctx = out.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, 0, 0, w, h);
      const blob = await out.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      frame.close();
    }
  } catch {
    return null;
  }
}

async function storeAvatar(admin: any, userId: string, bytes: Uint8Array): Promise<void> {
  const path = `${userId}/${OBJECT}`;
  await admin.storage.from(BUCKET).remove([path]); // overwrite cleanly
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw new Error(`Storage failed: ${error.message}`);
  // Cache-busting version so clients refetch instead of showing a stale face.
  const v = Date.now().toString(36);
  const { error: pErr } = await admin
    .from("profiles")
    .update({ avatar_url: `${path}?v=${v}` })
    .eq("id", userId);
  if (pErr) throw new Error(`Profile update failed: ${pErr.message}`);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  if (!supaUrl || !anonKey || !serviceKey) return bad("Function misconfigured.", 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return bad("Sign in first.", 401);
  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: ud, error: uErr } = await userClient.auth.getUser();
  if (uErr || !ud?.user) return bad("Sign in first.", 401);
  const user = ud.user;
  const admin = createClient(supaUrl, serviceKey);

  // ---- GET: current avatar path (or null) ---------------------------------
  if (req.method === "GET") {
    const { data } = await admin
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    return json({ avatar_url: (data as { avatar_url?: string } | null)?.avatar_url ?? null });
  }

  // ---- DELETE: remove picture ---------------------------------------------
  if (req.method === "DELETE") {
    await admin.storage.from(BUCKET).remove([`${user.id}/${OBJECT}`]).catch(() => {});
    const { error } = await admin.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    if (error) return bad(error.message, 500);
    return json({ ok: true });
  }

  // ---- POST: set picture ----------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Body must be JSON.");
  }

  const source = typeof body["source"] === "string" ? body["source"] : "upload";

  let raw: Uint8Array | null = null;
  if (source === "google") {
    // Google sign-in: the picture URL lives in identity_data / metadata.
    const identity = (user.identities ?? []).find((i: any) => i?.provider === "google");
    const idData = (identity?.identity_data ?? {}) as Record<string, unknown>;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const pic =
      (typeof idData.picture === "string" && idData.picture) ||
      (typeof meta.picture === "string" && meta.picture) ||
      (typeof meta.avatar_url === "string" && meta.avatar_url) ||
      "";
    if (!pic) return bad("No Google picture on this account, upload one instead.");
    try {
      const res = await fetch(pic, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return bad(`Google refused the picture fetch (${res.status}).`, 502);
      raw = new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      return bad(`Could not fetch the Google picture: ${e instanceof Error ? e.message : "error"}`, 502);
    }
  } else {
    const b64 = typeof body["image_base64"] === "string" ? body["image_base64"] : "";
    if (!b64) return bad("image_base64 required.");
    const cleaned = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
    const bin = atob(cleaned);
    raw = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) raw![i] = bin.charCodeAt(i);
    if (raw.byteLength > 12 * 1024 * 1024) return bad("Image too large (max 12 MB).");
  }

  const compressed = await compressToJpeg(raw);
  if (compressed) {
    raw = compressed;
  } else if (raw.byteLength > 300 * 1024) {
    // No ImageDecoder in this runtime and the source is heavy, refuse
    // rather than store megabytes under the guise of an avatar.
    return bad("Could not compress this image, try a smaller one.", 422);
  }

  try {
    await storeAvatar(admin, user.id, raw);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Store failed.", 500);
  }
  const { data } = await admin.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
  return json({ ok: true, avatar_url: (data as { avatar_url?: string } | null)?.avatar_url ?? null });
});
