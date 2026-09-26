// generate-social · metered model relay for the mobile AI writers.
//
// The mobile app builds rich, channel-aware prompts on-device (social.ts /
// gemini.ts). Rather than ship a provider key in the bundle — the exact
// bypass that left mobile AI unmetered — the app posts the finished prompt
// here and the key stays server-side. Every call is gated against the same
// AI credit ledger the web app uses, so Free gets its 20 credits and paid
// plans draw from their allowance.
//
// POST { prompt, grounding?, action?, request_id? }
//   → 200 { raw: <parsed model JSON> }
//   · 400 malformed · 401 unauthenticated · 402 not configured / out of
//     credits · 502 upstream failure (charge refunded)
//
// `action` picks the credit cost (post 2, thread 3, adapt 2, rewrite 1,
// longform 5 …); unknown values fall back to the cheapest cost. `grounding`
// turns on OpenAI web search for time-sensitive topics — search + JSON mode
// can't coexist, so grounded calls go out as text and the JSON is extracted
// from the reply, exactly like the old on-device OpenAI path.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  gateAiCredits, refundAiCredits, newRequestId,
  type AiGateContext,
} from "../_shared/usage.ts";
import { type AiAction, AI_CREDIT_COSTS, AI_MODEL_ID } from "../_shared/aiCredits.ts";

const SYSTEM_JSON =
  "You output strict JSON only. No markdown fences, no commentary.";

const MAX_PROMPT = 20000;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function bad(msg: string, status = 400): Response {
  return Response.json({ error: msg }, { status, headers: CORS });
}

function isAction(v: unknown): v is AiAction {
  return typeof v === "string" && v in AI_CREDIT_COSTS;
}

function providerErr(status: number, j: any): string {
  const msg = String(j?.error?.message ?? j?.message ?? "");
  if (status === 401 || /incorrect api key|invalid.*api key|unauthorized/i.test(msg)) {
    return "The AI key was rejected — an owner must update OPENAI_API_KEY.";
  }
  if (/insufficient_quota|exceeded.*quota|billing|credit/i.test(msg)) {
    return "AI is temporarily unavailable.";
  }
  if (status === 429 || /rate limit/i.test(msg)) return "Rate limit hit — wait a minute and retry.";
  if ((status >= 500 && status < 600) || /overload|server error/i.test(msg)) {
    return "The model is busy right now — try again in a moment.";
  }
  return msg || "Something went wrong while writing your post.";
}

/** Pull the first top-level JSON object out of model text. */
function extractJson(text: string): any {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("The model returned unusable JSON — try again.");
  return JSON.parse(m[0]);
}

/** One metered pass: Responses API, hosted web search when grounded. */
async function runModel(apiKey: string, prompt: string, search: boolean): Promise<any> {
  const body: Record<string, unknown> = {
    model: AI_MODEL_ID,
    input: `${SYSTEM_JSON}\n\n${prompt}`,
    max_output_tokens: 16384,
  };
  if (search) {
    // Search + JSON-mode lock is rejected upstream, so grounded calls go out
    // as text; the prompt still demands JSON-only output.
    body["tools"] = [{ type: "web_search" }];
  } else {
    body["text"] = { format: { type: "json_object" } };
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(providerErr(res.status, j));

  let text = "";
  for (const item of j?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const part of item?.content ?? []) {
      if (part?.type === "output_text" && typeof part.text === "string") text += part.text;
    }
  }
  return extractJson(text);
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
  if (!prompt) return bad("prompt is required.");
  if (prompt.length > MAX_PROMPT) return bad("prompt is too long.");

  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!apiKey) {
    return bad(
      "AI is not configured yet — an owner runs: supabase secrets set OPENAI_API_KEY=sk-...",
      402,
    );
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const requestId =
    typeof body["request_id"] === "string" && body["request_id"]
      ? body["request_id"]
      : newRequestId();
  const ctx: AiGateContext = { supaUrl, serviceKey, authHeader, anonKey };

  const action: AiAction = isAction(body["action"]) ? body["action"] : "post";
  if (serviceKey) {
    const gate = await gateAiCredits(ctx, action, requestId);
    if (!gate.ok) return bad(gate.message ?? "AI credits reached.", gate.status ?? 402);
  }
  const fail = async (msg: string): Promise<Response> => {
    if (serviceKey) await refundAiCredits(ctx, requestId);
    return bad(msg, 502);
  };

  try {
    const raw = await runModel(apiKey, prompt, body["grounding"] === true);
    return Response.json({ raw }, { headers: CORS });
  } catch (e) {
    return fail(`${String(e instanceof Error ? e.message : e).slice(0, 160)}`);
  }
});
