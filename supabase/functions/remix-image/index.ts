// remix-image · AI rework of a chosen photo, one at a time
//
// POST { image_url, prompt } → 200 { image: "data:image/png;base64,..." }
//   · 401 unauthenticated · 402 AI not configured · 502 upstream failure
//
// Uses the server-side OPENAI_API_KEY (gpt-image-1 edits endpoint) — the
// browser never sees the key. The caller downloads the data URL straight
// into the composer; nothing is stored server-side.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return bad("POST only", 405);

  const supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supaUrl || !anonKey) return bad("Function misconfigured.", 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return bad("Sign in first.", 401);
  try {
    const me = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!me.ok) return bad("Sign in first.", 401);
  } catch {
    return bad("Sign in first.", 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Body must be JSON.");
  }
  const imageUrl = typeof body["image_url"] === "string" ? body["image_url"].trim() : "";
  const prompt = typeof body["prompt"] === "string" ? body["prompt"].trim() : "";
  if (!imageUrl) return bad("image_url is required.");
  if (!/^https?:\/\//i.test(imageUrl)) return bad("image_url must be http(s).");
  if (!prompt) return bad("Describe the change first.");
  if (prompt.length > 1000) return bad("prompt ≤ 1000 chars.");

  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!apiKey) {
    return bad(
      "AI is not configured yet — an owner runs: supabase secrets set OPENAI_API_KEY=sk-...",
      402,
    );
  }

  let bytes: ArrayBuffer;
  let mime = "image/jpeg";
  try {
    const ir = await fetch(imageUrl, { redirect: "follow" });
    if (!ir.ok) return bad("Could not download that photo — try another.", 502);
    mime = (ir.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!mime.startsWith("image/")) return bad("That URL is not a photo — try another.", 502);
    bytes = await ir.arrayBuffer();
  } catch {
    return bad("Could not download that photo — try another.", 502);
  }
  if (bytes.byteLength > 10 * 1024 * 1024) return bad("That photo is too big — try another.", 502);

  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", prompt);
  form.append("image", new Blob([bytes], { type: mime }), `photo.${ext}`);
  form.append("size", "1024x1024");

  let b64 = "";
  try {
    const or = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const oj = (await or.json().catch(() => ({}))) as {
      data?: { b64_json?: string }[];
      error?: { message?: string };
    };
    b64 = oj.data?.[0]?.b64_json ?? "";
    if (!or.ok || !b64) {
      return bad(`The AI refused that rework. ${String(oj.error?.message ?? "").slice(0, 140)}`, 502);
    }
  } catch (e) {
    return bad(`AI provider unreachable (${String(e).slice(0, 120)}).`, 502);
  }

  return Response.json({ image: `data:image/png;base64,${b64}` }, { headers: CORS });
});
