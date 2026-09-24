// generate-image · AI picture from a text prompt (from-scratch generation)
//
// POST { prompt } → 200 { image: "data:image/png;base64,..." }
//   · 401 unauthenticated · 402 AI not configured · 502 upstream failure
//
// Uses the server-side OPENAI_API_KEY (gpt-image-1) — the browser never sees
// the key. The caller downloads the data URL straight into the composer;
// nothing is stored server-side.

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
  const prompt = typeof body["prompt"] === "string" ? body["prompt"].trim() : "";
  if (!prompt) return bad("Describe the picture first.");
  if (prompt.length > 1000) return bad("prompt ≤ 1000 chars.");

  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!apiKey) {
    return bad(
      "AI is not configured yet — an owner runs: supabase secrets set OPENAI_API_KEY=sk-...",
      402,
    );
  }

  let b64 = "";
  try {
    const or = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1536",
      }),
    });
    const oj = (await or.json().catch(() => ({}))) as {
      data?: { b64_json?: string }[];
      error?: { message?: string };
    };
    b64 = oj.data?.[0]?.b64_json ?? "";
    if (!or.ok || !b64) {
      return bad(`The AI refused that picture. ${String(oj.error?.message ?? "").slice(0, 140)}`, 502);
    }
  } catch (e) {
    return bad(`AI provider unreachable (${String(e).slice(0, 120)}).`, 502);
  }

  return Response.json({ image: `data:image/png;base64,${b64}` }, { headers: CORS });
});
