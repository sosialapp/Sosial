// team-avatar · get / set / clear a workspace's profile picture.
//
// POST { workspace_id, image_base64 } → compress to ≤256px JPEG server-side,
//   store as avatars/teams/<workspace_id>/pfp.jpg, update workspaces.
// POST { workspace_id, remove: true } → clear the column and the object.
// Only owners and admins of that workspace may write (checked against
// workspace_members directly, so no RPC grant questions). Members read the
// picture via signed URLs under the avatars_team_member_read policy.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_DIM = 256;
const JPEG_QUALITY = 0.72;
const BUCKET = "avatars";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

/** Decode + downscale + re-encode to JPEG bytes, null when unsupported. */
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

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405, headers: CORS });

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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Body must be JSON.");
  }
  const workspaceId = typeof body["workspace_id"] === "string" ? body["workspace_id"] : "";
  if (!workspaceId) return bad("workspace_id required.");

  const { data: mem } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  const role = (mem as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "admin") {
    return bad("Only team owners and admins can change the team picture.", 403);
  }

  const path = `teams/${workspaceId}/pfp.jpg`;

  if (body["remove"] === true) {
    await admin.storage.from(BUCKET).remove([path]).catch(() => {});
    const { error } = await admin.from("workspaces").update({ avatar_url: null }).eq("id", workspaceId);
    if (error) return bad(error.message, 500);
    return Response.json({ ok: true }, { headers: CORS });
  }

  const b64 = typeof body["image_base64"] === "string" ? body["image_base64"] : "";
  if (!b64) return bad("image_base64 required.");
  const cleaned = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(cleaned);
  let raw = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
  if (raw.byteLength > 12 * 1024 * 1024) return bad("Image too large (max 12 MB).");

  const compressed = await compressToJpeg(raw);
  if (compressed) {
    raw = compressed;
  } else if (raw.byteLength > 300 * 1024) {
    return bad("Could not compress this image, try a smaller one.", 422);
  }

  await admin.storage.from(BUCKET).remove([path]);
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, raw, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (upErr) return bad(`Storage failed: ${upErr.message}`, 500);
  const v = Date.now().toString(36);
  const { error: pErr } = await admin
    .from("workspaces")
    .update({ avatar_url: `${path}?v=${v}` })
    .eq("id", workspaceId);
  if (pErr) return bad(`Update failed: ${pErr.message}`, 500);
  const { data } = await admin.from("workspaces").select("avatar_url").eq("id", workspaceId).maybeSingle();
  return Response.json(
    { ok: true, avatar_url: (data as { avatar_url?: string } | null)?.avatar_url ?? null },
    { headers: CORS },
  );
});
