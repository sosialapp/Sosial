import { BSKY_RESOLVE, BSKY_PLC } from './bskyConfig';
import { loadProviderFields, saveProviderFields } from './metaStore';

/** Bluesky nests errors as { error, message }. */
function berr(j: any, fallback: string): string {
  const m = j?.message;
  const base = typeof m === 'string' && m.length > 0 ? m : fallback;
  if (/invalid identifier|invalid password|account is takendown|deactivated/i.test(base)) {
    return 'Wrong handle or app password — mint a fresh one at bsky.app → Settings → App passwords.';
  }
  return base;
}

async function bjson(r: Response): Promise<any> {
  return r.json().catch(() => ({}));
}

/**
 * Bare handles ("alice") are only accepted by the resolver with the default
 * server suffix, so "alice" becomes "alice.bsky.social". Custom domains
 * (anything with a dot) and DIDs are left as typed.
 */
export function normalizeBskyHandle(identifier: string): string {
  const id = identifier.trim().replace(/^@/, '');
  if (!id) return id;
  if (id.startsWith('did:')) return id;
  if (id.includes('.')) return id;
  return `${id}.bsky.social`;
}

/**
 * Handle (or DID) → { did, pdsHost }. Most accounts resolve through the PLC
 * directory; did:web self-hosters fall back to their well-known document.
 */
export async function resolvePds(identifier: string): Promise<{ did: string; pdsHost: string }> {
  const id = normalizeBskyHandle(identifier);
  if (!id) throw new Error('Enter your Bluesky handle first.');
  let did = id;
  if (!did.startsWith('did:')) {
    const r = await fetch(`${BSKY_RESOLVE}?handle=${encodeURIComponent(id)}`);
    const j: any = await bjson(r);
    if (!j.did) throw new Error(berr(j, 'Could not find that Bluesky handle.'));
    did = String(j.did);
  }
  const pdsHost = await pdsForDid(did);
  return { did, pdsHost };
}

async function pdsForDid(did: string): Promise<string> {
  // did:plc → PLC directory
  if (did.startsWith('did:plc:')) {
    const r = await fetch(`${BSKY_PLC}/${encodeURIComponent(did)}`);
    const j: any = await bjson(r);
    const svc = (j?.service ?? []).find(
      (s: any) => s?.id === '#atproto_pds' || s?.type === 'AtprotoPersonalDataServer',
    );
    const endpoint = String(svc?.serviceEndpoint ?? '').replace(/\/+$/, '');
    if (endpoint) return endpoint;
  }
  // did:web:example.com → https://example.com/.well-known/did.json
  if (did.startsWith('did:web:')) {
    const host = did.slice(8).split(':')[0];
    try {
      const r = await fetch(`https://${host}/.well-known/did.json`);
      const j: any = await bjson(r);
      const svc = (j?.service ?? []).find(
        (s: any) => s?.id === '#atproto_pds' || s?.type === 'AtprotoPersonalDataServer',
      );
      const endpoint = String(svc?.serviceEndpoint ?? '').replace(/\/+$/, '');
      if (endpoint) return endpoint;
    } catch {}
  }
  throw new Error('Could not find that account’s server — is the handle right?');
}

export interface BskySession {
  accessJwt: string;
  refreshJwt: string;
  expiresAt: number;
  did: string;
  handle: string;
  pdsHost: string;
}

/** identifier + app password -> session on the user's own PDS. */
export async function createBskySession(identifier: string, password: string): Promise<BskySession> {
  if (!password) throw new Error('Paste the app password too.');
  const { did, pdsHost } = await resolvePds(identifier);
  const r = await fetch(`${pdsHost}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: did, password }),
  });
  const j: any = await bjson(r);
  if (!j.accessJwt) throw new Error(berr(j, 'Bluesky login failed.'));
  return {
    accessJwt: j.accessJwt as string,
    refreshJwt: (j.refreshJwt as string) ?? '',
    expiresAt: Date.now() + 110 * 60 * 1000, // access tokens live ~2h; refresh early
    did: String(j.did ?? did),
    handle: String(j.handle ?? identifier).replace(/^@/, ''),
    pdsHost,
  };
}

/** Silent mint with the long-lived refresh token. */
export async function refreshBskySession(refreshJwt: string, pdsHost: string, fallbackDid: string, fallbackHandle: string): Promise<BskySession> {
  const r = await fetch(`${pdsHost}/xrpc/com.atproto.server.refreshSession`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${refreshJwt}` },
  });
  const j: any = await bjson(r);
  if (!j.accessJwt) throw new Error(berr(j, 'Bluesky session expired — reconnect Bluesky.'));
  return {
    accessJwt: j.accessJwt as string,
    refreshJwt: (j.refreshJwt as string) || refreshJwt,
    expiresAt: Date.now() + 110 * 60 * 1000,
    did: String(j.did ?? fallbackDid),
    handle: String(j.handle ?? fallbackHandle),
    pdsHost,
  };
}

export interface BskyCreds {
  token: string;
  did: string;
  pdsHost: string;
}

/**
 * The single entry every Bluesky call uses. Returns a live access token plus
 * the account's DID + PDS host, refreshing 10 min before expiry.
 */
export async function getValidBsky(accountId?: string, force = false): Promise<BskyCreds> {
  const f = await loadProviderFields('bluesky', accountId);
  const did = f.bskyDid as string | undefined;
  const pdsHost = f.bskyPdsHost as string | undefined;
  const access = f.bskyAccessJwt as string | undefined;
  const expiresAt = f.bskyExpiresAt as number | undefined;
  const refresh = f.bskyRefreshJwt as string | undefined;
  const handle = f.bskyHandle as string | undefined;
  if (!did || !pdsHost) throw new Error('Bluesky not connected');
  if (!force && access && expiresAt && expiresAt > Date.now() + 600000) {
    return { token: access, did, pdsHost };
  }
  if (!refresh) throw new Error('Bluesky not connected');
  try {
    const s = await refreshBskySession(refresh, pdsHost, did, handle ?? '');
    await saveProviderFields('bluesky', {
      bskyAccessJwt: s.accessJwt,
      bskyRefreshJwt: s.refreshJwt,
      bskyExpiresAt: s.expiresAt,
      bskyDid: s.did || did,
      bskyHandle: s.handle || handle,
      bskyPdsHost: pdsHost,
    }, accountId);
    return { token: s.accessJwt, did: s.did || did, pdsHost };
  } catch (e: any) {
    const msg = String(e?.message ?? '');
    if (/expired|invalid|unauthorized|bad request/i.test(msg)) {
      await saveProviderFields('bluesky', {
        bskyAccessJwt: undefined, bskyRefreshJwt: undefined, bskyExpiresAt: undefined,
      }, accountId);
      throw new Error('Bluesky session expired — reconnect Bluesky.');
    }
    throw e;
  }
}

/** Full login: handle + app password -> session, all saved to the vault. */
export async function completeBskyLogin(identifier: string, password: string, accountId?: string): Promise<{ name?: string }> {
  const s = await createBskySession(identifier, password);
  const name = s.handle ? `@${s.handle}` : undefined;
  let avatar: string | undefined;
  try {
    const r = await fetch(`${s.pdsHost}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(s.did)}`, {
      headers: { Authorization: `Bearer ${s.accessJwt}` },
    });
    const j: any = await r.json().catch(() => ({}));
    avatar = j?.avatar ? String(j.avatar) : undefined;
  } catch {}
  await saveProviderFields('bluesky', {
    bskyAccessJwt: s.accessJwt,
    bskyRefreshJwt: s.refreshJwt || undefined,
    bskyExpiresAt: s.expiresAt,
    bskyDid: s.did,
    bskyHandle: s.handle,
    bskyName: name,
    bskyPdsHost: s.pdsHost,
    avatar,
  }, accountId);
  return { name };
}
