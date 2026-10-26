// _shared/signedRequest.ts · Meta "signed_request" verification.
//
// Meta's Deauthorize and Data Deletion callbacks are unauthenticated POSTs:
// the ONLY proof they came from Meta is this field.
//
//   signed_request = base64url(hmac_sha256(<encoded payload>, app_secret))
//                    + "." + base64url(<payload json>)
//
// The signature covers the payload's *encoded* string exactly as received, so
// verify the middle segment instead of re-encoding the parsed JSON (key order
// and whitespace would change the bytes and every signature would fail).
// The payload carries { algorithm, issued_at, user_id }; user_id is the
// app-scoped id, the same value providers store in connected_channels.external_id.

export interface SignedRequest {
  userId: string;
  issuedAt: number;
  payload: Record<string, unknown>;
}

function b64urlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Constant-time compare: a length-dependent early return would leak nothing
// useful here, but the character loop keeps timing flat anyway.
function sameBytes(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Returns null for a malformed or mis-signed request; callers answer 4xx.
// Any secret that validates is enough: these callbacks may be signed by the
// Threads app, the Instagram app or the Facebook app depending on which app
// the user installed.
export async function verifySignedRequest(
  raw: string,
  secrets: string[],
): Promise<SignedRequest | null> {
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return null;
  const sigPart = raw.slice(0, dot);
  const payloadPart = raw.slice(dot + 1);

  const enc = new TextEncoder();
  for (const secret of secrets) {
    if (!secret) continue;
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payloadPart)));
    if (!sameBytes(bytesToB64url(digest), sigPart)) continue;

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadPart)));
    } catch {
      return null;
    }
    const userId = String(payload["user_id"] ?? "");
    if (!userId) return null;
    return {
      userId,
      issuedAt: Number(payload["issued_at"] ?? 0),
      payload,
    };
  }
  return null;
}

// Meta posts application/x-www-form-urlencoded; the query fallback is for
// hand-testing (curl "…?signed_request=…").
export async function signedRequestField(req: Request): Promise<string> {
  try {
    const body = await req.text();
    if (body) {
      const form = new URLSearchParams(body);
      const value = form.get("signed_request");
      if (value) return value;
    }
  } catch {
    // fall through to the query string
  }
  return new URL(req.url).searchParams.get("signed_request") ?? "";
}