// oauth-exchange · web OAuth code → tokens + profile (mobile parity)
//
// The browser never touches secrets: Next.js /api/oauth/* routes collect the
// ?code= and call this function with the caller's JWT. Each driver mirrors
// the mobile exchange in src/utils/*Auth.ts (endpoints, params, profile
// reads), then returns an import-ready payload, the route finishes the job
// through import-channel-token with the same user JWT.
//
// POST { provider, code?, verifier?, redirect_uri?, workspace_id?,
///        handle?, app_password? } → 200 payload (per provider below)
//   · 401 unauthenticated · 402 provider not configured · 502 upstream failure
//
// facebook returns { pages: [{ id, name, access_token, picture?, ig?,
// missing?, viaBusiness? }] } - every Page the user can reach, paged to the
// end and including business-portfolio pages when business_management is
// granted. `missing` marks a Page with no token (no content task), so the
// picker can grey it out instead of dropping it. The web route shows a Page
// picker and imports the chosen Page (tokens are per-Page on Meta, there is
// no user-level channel to store).
//
// Supabase secrets: TT_CLIENT_KEY, TT_CLIENT_SECRET, META_APP_ID,
// META_APP_SECRET, IG_APP_ID, IG_APP_SECRET, X_CLIENT_ID, YT_CLIENT_ID,
// YT_CLIENT_SECRET, LI_CLIENT_ID, LI_CLIENT_SECRET.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function bad(msg: string, status = 400): Response {
  // Cloudflare in front of the gateway REPLACES every 4xx/5xx body with its
  // own "error code: N" page, so a refused login would reach the caller as
  // the generic "Edge Function returned a non-2xx status code" instead of the
  // reason. Carry every provider refusal inside a 200 body so the real
  // message survives; only the "Sign in first." gate keeps a hard 401 for
  // the mobile-parity contract.
  if (status === 401) return Response.json({ error: msg }, { status, headers: CORS });
  return Response.json({ error: msg }, { status: 200, headers: CORS });
}

function ok(payload: Record<string, unknown>): Response {
  return Response.json(payload, { headers: CORS });
}

const iso = (ms: number): string => new Date(ms).toISOString();

function form(p: Record<string, string>): string {
  return Object.entries(p)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function json(r: Response): Promise<Record<string, unknown>> {
  try {
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Provider ids are strings on most networks but numbers on some (Threads
 *  user_id), coerce rather than blanking them, or the exchange wrongly
 *  reports a hidden account. */
const str = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : "";

/* --------------------------------- drivers -------------------------------- */

interface ExchangeBody {
  code: string;
  verifier: string;
  redirect_uri: string;
  handle: string;
  app_password: string;
  /** Mastodon only: instance + per-instance app credentials from the start route. */
  instance: string;
  client_id: string;
  client_secret: string;
}

async function tiktok(b: ExchangeBody): Promise<Response> {
  const key = Deno.env.get("TT_CLIENT_KEY") ?? "";
  const secret = Deno.env.get("TT_CLIENT_SECRET") ?? "";
  if (!key || !secret) return bad("TikTok is not configured yet.", 402);
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      client_key: key,
      client_secret: secret,
      code: b.code,
      grant_type: "authorization_code",
      redirect_uri: b.redirect_uri,
    }),
  });
  const j = await json(r);
  const access = str(j.access_token);
  if (!access) {
    const err = j.error as { code?: string; message?: string } | undefined;
    return bad(`TikTok refused the login (${str(err?.code) || r.status}). ${str(err?.message).slice(0, 120)}`, 502);
  }
  const refresh = str(j.refresh_token);
  const expiresAt = Date.now() + Number(j.expires_in ?? 86400) * 1000;
  let openId = str(j.open_id);
  let name: string | undefined;
  let avatar: string | undefined;
  try {
    const pr = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
      { headers: { Authorization: `Bearer ${access}` } },
    );
    const pj = await json(pr);
    const u = (pj.data as { user?: { open_id?: string; display_name?: string; avatar_url?: string } } | undefined)?.user;
    if (u?.open_id) {
      openId = String(u.open_id);
      if (u.display_name) name = `@${u.display_name}`;
      if (u.avatar_url) avatar = String(u.avatar_url);
    }
  } catch { /* profile is best-effort */ }
  if (!openId) return bad("TikTok hid the account id, try again.", 502);
  // Creator info also carries the privacy levels this account may post with —
  // the composer needs them for the audience picker (TikTok refuses to
  // publish a privacy_level outside this list, so it is never guessed).
  let privacyOptions: string[] = [];
  try {
    const cr = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json; charset=UTF-8" },
      body: "{}",
    });
    const cj = await json(cr);
    const d = cj.data as { creator_nickname?: string; privacy_level_options?: unknown[] } | undefined;
    if (d?.creator_nickname) name = `@${d.creator_nickname}`;
    if (Array.isArray(d?.privacy_level_options)) {
      privacyOptions = d.privacy_level_options.map(String);
    }
  } catch { /* best-effort */ }
  return ok({
    access_token: access,
    refresh_token: refresh || undefined,
    expires_at: iso(expiresAt),
    external_id: openId,
    display_name: name,
    metadata: { avatar, ttPrivacyOptions: privacyOptions },
  });
}

async function instagram(b: ExchangeBody): Promise<Response> {
  const id = Deno.env.get("IG_APP_ID") ?? "";
  const secret = Deno.env.get("IG_APP_SECRET") ?? "";
  if (!id || !secret) return bad("Instagram is not configured yet.", 402);
  const r1 = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      client_id: id,
      client_secret: secret,
      grant_type: "authorization_code",
      redirect_uri: b.redirect_uri,
      code: b.code,
    }),
  });
  const j1 = await json(r1);
  const first = Array.isArray(j1.data) ? (j1.data[0] as Record<string, unknown> | undefined) : undefined;
  const shortToken = str(first?.access_token ?? j1.access_token);
  const userId = str(first?.user_id ?? j1.user_id);
  if (!shortToken) return bad(`Instagram refused the login (${r1.status}).`, 502);
  // 1h token → 60-day token.
  const r2 = await fetch(
    `https://graph.instagram.com/access_token?${form({
      grant_type: "ig_exchange_token",
      client_secret: secret,
      access_token: shortToken,
    })}`,
  );
  const j2 = await json(r2);
  const token = str(j2.access_token);
  if (!token) return bad("Instagram would not issue a long-lived token.", 502);
  // Mobile parity: the STABLE profile id keys the row, never the username.
  // (A username-keyed row from an id-less exchange would ghost-duplicate the
  // numeric row on every reconnect, invisible to the upsert.)
  let profileId = "";
  let username: string | undefined;
  let picture: string | undefined;
  try {
    const pr = await fetch(
      `https://graph.instagram.com/me?${form({ fields: "id,username,profile_picture_url", access_token: token })}`,
    );
    const pj = await json(pr);
    if (!pj.error) {
      profileId = str(pj.id);
      if (pj.username) username = `@${pj.username}`;
      if (pj.profile_picture_url) picture = String(pj.profile_picture_url);
    }
  } catch { /* best-effort */ }
  const externalId = profileId || userId;
  if (!externalId) return bad("Instagram hid the account id, try again.", 502);
  return ok({
    access_token: token,
    external_id: externalId,
    display_name: username,
    metadata: picture ? { avatar: picture } : {},
  });
}

const FB_FIELDS = "id,name,access_token,picture,instagram_business_account{id,username}";

interface FbPage {
  id: string;
  name: string;
  access_token: string;
  picture?: string;
  ig?: string;
  /** Listed but with no Page token: the role carries no content task, so the
   *  Page can be shown greyed out instead of silently disappearing. */
  missing?: boolean;
  /** Only reachable through a business portfolio, not a direct Page role. */
  viaBusiness?: boolean;
}

/** Walk a Graph edge to the end. Graph pages at 25 rows by default, which is
 *  the usual reason a user who manages a dozen Pages only sees a couple.
 *  `strict` keeps the old contract for the main call: a refusal fails the
 *  connect instead of reading as an empty account list. */
async function fbEdge(url: string, strict = false): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let next: string | null = url;
  for (let i = 0; next && i < 20; i += 1) {
    const j = await json(await fetch(next));
    if (j.error) {
      if (strict) throw new Error(str((j.error as { message?: unknown })?.message) || "Graph refused the call.");
      return out;
    }
    if (Array.isArray(j.data)) out.push(...(j.data as Record<string, unknown>[]));
    const paging = j.paging as { next?: unknown } | undefined;
    next = typeof paging?.next === "string" && paging.next ? paging.next : null;
  }
  return out;
}

async function facebook(b: ExchangeBody): Promise<Response> {
  const id = Deno.env.get("META_APP_ID") ?? "";
  const secret = Deno.env.get("META_APP_SECRET") ?? "";
  if (!id || !secret) return bad("Facebook is not configured yet.", 402);
  const G = "https://graph.facebook.com/v21.0";
  const r1 = await fetch(
    `${G}/oauth/access_token?${form({ client_id: id, redirect_uri: b.redirect_uri, client_secret: secret, code: b.code })}`,
  );
  const j1 = await json(r1);
  if (!j1.access_token) {
    const e = j1.error as { message?: string } | undefined;
    return bad(`Facebook refused the login. ${str(e?.message).slice(0, 140)}`, 502);
  }
  const r2 = await fetch(
    `${G}/oauth/access_token?${form({
      grant_type: "fb_exchange_token",
      client_id: id,
      client_secret: secret,
      fb_exchange_token: String(j1.access_token),
    })}`,
  );
  const j2 = await json(r2);
  const userToken = str(j2.access_token);
  if (!userToken) return bad("Facebook would not issue a long-lived token.", 502);

  const pages = new Map<string, FbPage>();
  const remember = (raw: Record<string, unknown>, viaBusiness: boolean) => {
    const id = str(raw.id);
    if (!id) return;
    const token = str(raw.access_token);
    const prev = pages.get(id);
    // First sighting wins unless the newcomer actually carries a token.
    if (prev && (prev.access_token || !token)) {
      if (viaBusiness) prev.viaBusiness = true;
      return;
    }
    const pic = raw.picture as { data?: { url?: unknown } } | undefined;
    const ig = raw.instagram_business_account as { username?: unknown } | undefined;
    pages.set(id, {
      id,
      name: str(raw.name) || "Page",
      access_token: token,
      picture: typeof pic?.data?.url === "string" ? pic.data.url : undefined,
      ig: typeof ig?.username === "string" ? `@${ig.username}` : undefined,
      missing: token ? undefined : true,
      viaBusiness: viaBusiness || undefined,
    });
  };

  let accounts: Record<string, unknown>[];
  try {
    accounts = await fbEdge(
      `${G}/me/accounts?${form({ fields: FB_FIELDS, limit: "100", access_token: userToken })}`,
      true,
    );
  } catch (e) {
    return bad(`Could not list your Pages. ${str((e as Error)?.message).slice(0, 140)}`, 502);
  }
  for (const a of accounts) remember(a, false);

  // Pages held by a business portfolio (owned/client) never appear in
  // /me/accounts; that edge needs business_management. Probe the grant first
  // and stay quiet without it, the direct list above is still complete.
  try {
    const granted = new Set(
      (await fbEdge(`${G}/me/permissions?${form({ limit: "100", access_token: userToken })}`))
        .filter((p) => str(p.status) === "granted")
        .map((p) => str(p.permission)),
    );
    if (granted.has("business_management")) {
      const businesses = await fbEdge(
        `${G}/me/businesses?${form({ fields: "id,name", limit: "100", access_token: userToken })}`,
      );
      for (const biz of businesses) {
        const bid = str(biz.id);
        if (!bid) continue;
        for (const edge of ["owned_pages", "client_pages"]) {
          const list = await fbEdge(
            `${G}/${encodeURIComponent(bid)}/${edge}?${form({ fields: FB_FIELDS, limit: "100", access_token: userToken })}`,
          );
          for (const p of list) remember(p, true);
        }
      }
    }
  } catch {
    /* portfolio pages are best-effort, never break the connect */
  }

  return ok({ pages: [...pages.values()] });
}

async function xAuth(b: ExchangeBody): Promise<Response> {
  const id = Deno.env.get("X_CLIENT_ID") ?? "";
  if (!id) return bad("X is not configured yet.", 402);
  if (!b.verifier) return bad("X login was interrupted, try connecting again.", 400);
  const r = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      client_id: id,
      code: b.code,
      grant_type: "authorization_code",
      redirect_uri: b.redirect_uri,
      code_verifier: b.verifier,
    }),
  });
  const j = await json(r);
  const access = str(j.access_token);
  if (!access) {
    return bad(`X refused the login. ${str(j.error_description ?? j.detail).slice(0, 140)}`, 502);
  }
  const refresh = str(j.refresh_token);
  const expiresAt = Date.now() + Number(j.expires_in ?? 7200) * 1000;
  let uid = "";
  let name: string | undefined;
  let picture: string | undefined;
  try {
    const pr = await fetch("https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url", {
      headers: { Authorization: `Bearer ${access}` },
    });
    const pj = await json(pr);
    const u = pj.data as { id?: string; username?: string; profile_image_url?: string } | undefined;
    if (u?.id) {
      uid = String(u.id);
      if (u.username) name = `@${u.username}`;
      if (u.profile_image_url) picture = String(u.profile_image_url).replace("_normal.", ".");
    }
  } catch { /* best-effort */ }
  if (!uid) return bad("X hid the account id, try again.", 502);
  return ok({
    access_token: access,
    refresh_token: refresh || undefined,
    expires_at: iso(expiresAt),
    external_id: uid,
    display_name: name,
    // Public OAuth client id, the worker needs it for silent refresh.
    metadata: { ...(picture ? { avatar: picture } : {}), xClientId: id },
  });
}

async function youtube(b: ExchangeBody): Promise<Response> {
  const id = Deno.env.get("YT_CLIENT_ID") ?? "";
  const secret = Deno.env.get("YT_CLIENT_SECRET") ?? "";
  if (!id || !secret) return bad("YouTube is not configured yet.", 402);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      grant_type: "authorization_code",
      code: b.code,
      client_id: id,
      client_secret: secret,
      redirect_uri: b.redirect_uri,
    }),
  });
  const j = await json(r);
  const access = str(j.access_token);
  if (!access) {
    return bad(`Google refused the login. ${str(j.error_description ?? j.error).slice(0, 140)}`, 502);
  }
  const refresh = str(j.refresh_token);
  const expiresAt = Date.now() + (Number(j.expires_in) || 3600) * 1000;
  let channelId = "";
  let title: string | undefined;
  let avatar: string | undefined;
  try {
    const cr = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { Authorization: `Bearer ${access}` },
    });
    const cj = await json(cr);
    const item = Array.isArray(cj.items) ? (cj.items[0] as { id?: string; snippet?: { title?: string; thumbnails?: Record<string, { url?: string }> } } | undefined) : undefined;
    if (item?.id) {
      channelId = String(item.id);
      if (item.snippet?.title) title = String(item.snippet.title);
      const th = item.snippet?.thumbnails;
      const url = th?.high?.url ?? th?.medium?.url ?? th?.default?.url;
      if (url) avatar = String(url);
    }
  } catch { /* best-effort */ }
  if (!channelId) return bad("Google hid the channel, try again.", 502);
  return ok({
    access_token: access,
    refresh_token: refresh || undefined,
    expires_at: iso(expiresAt),
    external_id: channelId,
    display_name: title,
    metadata: avatar ? { avatar } : {},
  });
}

async function linkedin(b: ExchangeBody): Promise<Response> {
  const id = Deno.env.get("LI_CLIENT_ID") ?? "";
  const secret = Deno.env.get("LI_CLIENT_SECRET") ?? "";
  if (!id || !secret) return bad("LinkedIn is not configured yet.", 402);
  const r = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      grant_type: "authorization_code",
      code: b.code,
      client_id: id,
      client_secret: secret,
      redirect_uri: b.redirect_uri,
    }),
  });
  const j = await json(r);
  const access = str(j.access_token);
  if (!access) {
    return bad(`LinkedIn refused the login. ${str(j.error_description ?? j.error).slice(0, 140)}`, 502);
  }
  const refresh = str(j.refresh_token);
  const expiresAt = Date.now() + Number(j.expires_in ?? 5184000) * 1000;
  const pr = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${access}` },
  });
  const pj = await json(pr);
  const sub = str(pj.sub);
  if (!sub) return bad("LinkedIn hid the member id, try again.", 502);
  const full = `${str(pj.given_name)} ${str(pj.family_name)}`.trim();
  return ok({
    access_token: access,
    refresh_token: refresh || undefined,
    expires_at: iso(expiresAt),
    external_id: `urn:li:person:${sub}`,
    display_name: full ? `@${full}` : undefined,
    metadata: str(pj.picture) ? { avatar: str(pj.picture) } : {},
  });
}

function normalizeHandle(identifier: string): string {
  let id = identifier.trim();
  // Full profile URLs are what people actually copy from the app.
  id = id.replace(/^https?:\/\/(?:www\.)?bsky\.app\/profile\//i, "");
  id = id.replace(/^https?:\/\//i, "");
  id = id.replace(/[?#].*$/, "");
  id = id.replace(/\/+$/, "");
  id = id.replace(/^@+/, "");
  if (!id || id.startsWith("did:") || id.includes(".") || id.includes("@")) return id;
  return `${id}.bsky.social`;
}

async function bluesky(b: ExchangeBody): Promise<Response> {
  const identifier = normalizeHandle(b.handle);
  const password = b.app_password.trim();
  if (!identifier) return bad("Enter your Bluesky handle first.", 400);
  if (!password) return bad("Paste the app password too.", 400);
  // Emails are a valid createSession identifier but can't be resolved to a
  // DID, so pass them straight through to the PDS.
  const isEmail = identifier.includes("@");
  let did = identifier;
  if (!did.startsWith("did:") && !isEmail) {
    const rr = await fetch(
      `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(identifier)}`,
    );
    const rj = await json(rr);
    if (!rj.did) return bad("Could not find that Bluesky handle.", 400);
    did = String(rj.did);
  }
  let pdsHost = "";
  if (did.startsWith("did:plc:")) {
    const dr = await fetch(`https://plc.directory/${encodeURIComponent(did)}`);
    const dj = await json(dr);
    const svc = (Array.isArray(dj.service) ? dj.service : []).find(
      (s: { id?: string; type?: string; serviceEndpoint?: string }) =>
        s?.id === "#atproto_pds" || s?.type === "AtprotoPersonalDataServer",
    ) as { serviceEndpoint?: string } | undefined;
    pdsHost = String(svc?.serviceEndpoint ?? "").replace(/\/+$/, "");
  } else if (did.startsWith("did:web:")) {
    const host = did.slice(8).split(":")[0];
    try {
      const dr = await fetch(`https://${host}/.well-known/did.json`);
      const dj = await json(dr);
      const svc = (Array.isArray(dj.service) ? dj.service : []).find(
        (s: { id?: string; type?: string; serviceEndpoint?: string }) =>
          s?.id === "#atproto_pds" || s?.type === "AtprotoPersonalDataServer",
      ) as { serviceEndpoint?: string } | undefined;
      pdsHost = String(svc?.serviceEndpoint ?? "").replace(/\/+$/, "");
    } catch { /* falls through */ }
  }
  if (!pdsHost) return bad("Could not find that account's server, is the handle right?", 400);
  const sr = await fetch(`${pdsHost}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: did, password }),
  });
  const sj = await json(sr);
  if (!sj.accessJwt) {
    return bad("Wrong handle or app password, mint a fresh one at bsky.app → Settings → App passwords.", 400);
  }
  const handle = String(sj.handle ?? identifier).replace(/^@/, "");
  let avatar: string | undefined;
  try {
    const gr = await fetch(
      `${pdsHost}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(String(sj.did ?? did))}`,
      { headers: { Authorization: `Bearer ${String(sj.accessJwt)}` } },
    );
    const gj = await json(gr);
    if (gj.avatar) avatar = String(gj.avatar);
  } catch { /* best-effort */ }
  return ok({
    // The APP PASSWORD is the stored credential, not the session JWT: the
    // unified sync engine mints its own 40-min-cached sessions per sweep
    // from Vault (createSession per sync), and JWTs die in ~2h while app
    // passwords live until revoked. The verify session is discarded here.
    access_token: password,
    external_id: String(sj.did ?? did),
    handle,
    display_name: handle ? `@${handle}` : undefined,
    instance_url: pdsHost,
    token_type: "AppPassword",
    metadata: { bluesky_handle: handle, ...(avatar ? { avatar } : {}) },
  });
}

async function threads(b: ExchangeBody): Promise<Response> {
  const id = Deno.env.get("THREADS_APP_ID") ?? "";
  const secret = Deno.env.get("THREADS_APP_SECRET") ?? "";
  if (!id || !secret) return bad("Threads is not configured yet.", 402);
  const API = "https://graph.threads.net";
  const r1 = await fetch(`${API}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      client_id: id,
      client_secret: secret,
      code: b.code,
      grant_type: "authorization_code",
      redirect_uri: b.redirect_uri,
    }),
  });
  const j1 = await json(r1);
  if (!j1.access_token) {
    const e = j1.error as { message?: string } | undefined;
    return bad(`Threads refused the login. ${str(e?.message).slice(0, 140)}`, 502);
  }
  // NOTE: this endpoint is GET-only per docs, POSTing makes the router treat
  // "access_token" as an object ID ("Unsupported post request…").
  const r2 = await fetch(
    `${API}/access_token?${form({
      grant_type: "th_exchange_token",
      client_secret: secret,
      access_token: String(j1.access_token),
    })}`,
  );
  const j2 = await json(r2);
  const token = str(j2.access_token);
  if (!token) {
    // Surface Threads' actual refusal (rate limit, token expired mid-flight,
    // app-mode restriction …) instead of a blind generic line.
    const e = j2.error as { message?: string } | undefined;
    return bad(
      `Threads would not issue a long-lived token. ${str(e?.message).slice(0, 160)} (step2 ${r2.status})`,
      502,
    );
  }
  const userId = str(j1.user_id);
  let username: string | undefined;
  let picture: string | undefined;
  try {
    const pr = await fetch(
      `${API}/v1.0/me?${form({ fields: "id,username,threads_profile_picture_url", access_token: token })}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const pj = await json(pr);
    if (!pj.error) {
      if (pj.username) username = `@${pj.username}`;
      if (pj.threads_profile_picture_url) picture = String(pj.threads_profile_picture_url);
    }
  } catch { /* best-effort */ }
  // Mobile parity: the exchange user id keys the row, a username-keyed row
  // would ghost-duplicate it on reconnect, invisible to the upsert.
  if (!userId) return bad("Threads hid the account, try again.", 502);
  return ok({
    access_token: token,
    external_id: userId,
    display_name: username,
    metadata: picture ? { avatar: picture } : {},
  });
}

function mastodonBase(instance: string): string {
  return `https://${instance}`;
}

async function mastodon(b: ExchangeBody): Promise<Response> {
  const instance = b.instance.trim().toLowerCase();
  if (!instance || !b.client_id) return bad("Mastodon login was interrupted, try connecting again.", 400);
  const base = mastodonBase(instance);
  const r = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      grant_type: "authorization_code",
      code: b.code,
      client_id: b.client_id,
      client_secret: b.client_secret,
      redirect_uri: b.redirect_uri,
      scope: "read write",
    }),
  });
  const j = await json(r);
  const access = str(j.access_token);
  if (!access) {
    const desc = str(j.error_description ?? (typeof j.error === "string" ? j.error : ""));
    // Burned/replayed codes surface as invalid_grant, almost always a double
    // delivery of the same login, so say so instead of quoting server text.
    if (/invalid_grant|authorization grant/i.test(desc)) {
      return bad("That login link was already used, if Mastodon shows Connected below, you're all set.", 502);
    }
    return bad(`Mastodon refused the login. ${desc.slice(0, 140)}`, 502);
  }
  // Tokens from API-registered apps are long-lived; no refresh token is issued.
  const pr = await fetch(`${base}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const pj = await json(pr);
  const uid = str(pj.id);
  if (!uid) return bad("Could not read your Mastodon profile.", 502);
  const acct = str(pj.acct);
  return ok({
    access_token: access,
    external_id: uid,
    display_name: acct ? `@${acct}` : undefined,
    instance_url: base,
    metadata: str(pj.avatar) ? { avatar: str(pj.avatar) } : {},
  });
}

async function pinterest(b: ExchangeBody): Promise<Response> {
  const id = Deno.env.get("PIN_CLIENT_ID") ?? "";
  const secret = Deno.env.get("PIN_CLIENT_SECRET") ?? "";
  if (!id || !secret) return bad("Pinterest is not configured yet.", 402);
  const r = await fetch("https://api.pinterest.com/v5/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // HTTP Basic (base64 app_id:secret), NOT body creds.
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
    },
    body: form({ grant_type: "authorization_code", code: b.code, redirect_uri: b.redirect_uri }),
  });
  const j = await json(r);
  const access = str(j.access_token);
  if (!access) {
    return bad(`Pinterest refused the login. ${str(j.error_description ?? j.message).slice(0, 140)}`, 502);
  }
  const refresh = str(j.refresh_token);
  const expiresAt = Date.now() + (Number(j.expires_in) || 2592000) * 1000;
  const pr = await fetch("https://api.pinterest.com/v5/user_account", {
    headers: { Authorization: `Bearer ${access}` },
  });
  const pj = await json(pr);
  const username = str(pj.username);
  if (!pr.ok || !username) return bad("Could not read your Pinterest profile.", 502);
  // Mobile parity: the @-prefixed username IS the external id.
  // v5 returns profile_image as a plain URL string (older shape: an object of
  // size keys), accept both.
  const img = pj.profile_image as
    | string
    | { medium_https?: string; small_https?: string; large_https?: string }
    | undefined;
  const avatar = typeof img === "string" ? img : img?.medium_https ?? img?.small_https ?? img?.large_https;
  return ok({
    access_token: access,
    refresh_token: refresh || undefined,
    expires_at: iso(expiresAt),
    external_id: `@${username}`,
    display_name: `@${username}`,
    metadata: avatar ? { avatar: String(avatar) } : {},
  });
}

const GMB_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
];

async function gmbList(access: string, url: string): Promise<Record<string, unknown>> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
  return json(r);
}

async function gmb(b: ExchangeBody): Promise<Response> {
  const id = Deno.env.get("YT_CLIENT_ID") ?? Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const secret = Deno.env.get("YT_CLIENT_SECRET") ?? Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
  if (!id || !secret) return bad("Google Business is not configured yet.", 402);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      code: b.code,
      client_id: id,
      client_secret: secret,
      redirect_uri: b.redirect_uri,
      grant_type: "authorization_code",
    }),
  });
  const j = await json(r);
  const access = str(j.access_token);
  if (!access) {
    return bad(`Google refused the login. ${str(j.error_description ?? j.error ?? j.message).slice(0, 140)}`, 502);
  }
  const refresh = str(j.refresh_token);
  const expiresAt = Date.now() + (Number(j.expires_in) || 3600) * 1000;
  // Locations across every accessible account, the picker stages like
  // Facebook Pages.
  const out: { name: string; title: string }[] = [];
  try {
    const accounts = (await gmbList(access, "https://mybusinessaccountmanagement.googleapis.com/v1/accounts")) as {
      accounts?: { name: string; accountName?: string }[];
    };
    for (const a of accounts.accounts ?? []) {
      const locs = (await gmbList(
        access,
        `https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?pageSize=100&readMask=name,title`,
      )) as { locations?: { name: string; title?: string }[] };
      for (const l of locs.locations ?? []) {
        out.push({ name: l.name, title: l.title || a.accountName || l.name });
      }
    }
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (/403|permission|disabled|not been used/i.test(msg)) {
      return bad(
        "Your Google Cloud project doesn't have Business Profile API access yet, approve it once in the Google API console, then reconnect.",
        502,
      );
    }
    return bad("Could not read your Business Profile locations.", 502);
  }
  if (out.length === 0) {
    return bad("No Business Profile locations found on that Google account.", 400);
  }
  return ok({
    access_token: access,
    refresh_token: refresh || undefined,
    expires_at: iso(expiresAt),
    // Location pick comes next (staged); these carry over via the stash.
    external_id: "gmb:pending",
    display_name: "Google Business",
    locations: out,
  });
}

async function reddit(_b: ExchangeBody): Promise<Response> {
  void _b;
  return bad("Reddit is not supported in this build.", 410);
}

/* --------------------------------- server --------------------------------- */

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
  const provider = str(body["provider"]);
  const b: ExchangeBody = {
    code: str(body["code"]),
    verifier: str(body["verifier"]),
    redirect_uri: str(body["redirect_uri"]),
    handle: str(body["handle"]),
    app_password: str(body["app_password"]),
    instance: str(body["instance"]),
    client_id: str(body["client_id"]),
    client_secret: str(body["client_secret"]),
  };

  try {
    switch (provider) {
      case "tiktok":
        if (!b.code || !b.redirect_uri) return bad("code and redirect_uri required.", 400);
        return await tiktok(b);
      case "instagram":
        if (!b.code || !b.redirect_uri) return bad("code and redirect_uri required.", 400);
        return await instagram(b);
      case "facebook":
        if (!b.code || !b.redirect_uri) return bad("code and redirect_uri required.", 400);
        return await facebook(b);
      case "x":
        if (!b.code || !b.redirect_uri) return bad("code and redirect_uri required.", 400);
        return await xAuth(b);
      case "youtube":
        if (!b.code || !b.redirect_uri) return bad("code and redirect_uri required.", 400);
        return await youtube(b);
      case "linkedin":
        if (!b.code || !b.redirect_uri) return bad("code and redirect_uri required.", 400);
        return await linkedin(b);
      case "threads":
        if (!b.code || !b.redirect_uri) return bad("code and redirect_uri required.", 400);
        return await threads(b);
      case "mastodon":
        if (!b.code || !b.redirect_uri || !b.instance || !b.client_id) {
          return bad("Mastodon login was interrupted, try connecting again.", 400);
        }
        return await mastodon(b);
      case "pinterest":
        if (!b.code || !b.redirect_uri) return bad("code and redirect_uri required.", 400);
        return await pinterest(b);
      case "reddit":
        if (!b.code || !b.redirect_uri) return bad("code and redirect_uri required.", 400);
        return await reddit(b);
      case "gmb":
        if (!b.code || !b.redirect_uri) return bad("code and redirect_uri required.", 400);
        return await gmb(b);
      case "bluesky":
        return await bluesky(b);
      default:
        return bad(`Unknown provider: ${provider.slice(0, 40)}.`, 400);
    }
  } catch (e) {
    return bad(`Exchange failed (${String(e).slice(0, 120)}).`, 502);
  }
});
