/**
 * Ghost Admin API key validation + a tiny HS256 JWT signer (device-side).
 *
 * React Native has no node:crypto — HMAC-SHA256 is implemented in pure JS
 * (RFC 4231 test vectors pin its correctness in ghostJwt.test.ts). Token
 * shape per Ghost docs: {id}:{hex secret} → JWT {alg:HS256,typ:JWT,kid:id},
 * payload {iat, exp:+5min, aud:'/admin/'}, Authorization: Ghost <jwt>.
 */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesFromHex(hex: string): number[] {
  const clean = hex.trim().toLowerCase();
  if (!/^[0-9a-f]*$/.test(clean) || clean.length === 0 || clean.length % 2 !== 0) {
    throw new Error('Admin API key looks wrong (expected id:secret).');
  }
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

function b64urlFromBytes(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[(b0 >> 2) & 63];
    out += b1 === undefined ? B64[(b0 & 3) << 4] : B64[((b0 & 3) << 4) | (b1 >> 4)];
    if (b1 === undefined) out += '==';
    else {
      out += b2 === undefined ? B64[(b1 & 15) << 2] : B64[((b1 & 15) << 2) | (b2 >> 6)];
      if (b2 === undefined) out += '=';
      else out += B64[b2 & 63];
    }
  }
  return out.replace(/=+$/, '');
}

function utf8Bytes(str: string): number[] {
  // encodeURIComponent → percent bytes is the standard RN-safe UTF-8 trick.
  const esc = encodeURIComponent(str);
  const out: number[] = [];
  for (let i = 0; i < esc.length; i++) {
    if (esc[i] === '%') {
      out.push(parseInt(esc.slice(i + 1, i + 3), 16));
      i += 2;
    } else out.push(esc.charCodeAt(i));
  }
  return out;
}

/** HMAC-SHA256 (RFC 4231) over byte arrays — pure JS, RN-safe. */
export function hmacSha256(key: number[], message: number[]): number[] {
  const BLOCK = 64;
  let k = key.slice();
  if (k.length > BLOCK) k = sha256(k);
  while (k.length < BLOCK) k.push(0);
  const ipad = k.map((b) => b ^ 0x36);
  const opad = k.map((b) => b ^ 0x5c);
  return sha256(opad.concat(sha256(ipad.concat(message))));
}

function rotl(n: number, b: number): number {
  return ((n << b) | (n >>> (32 - b))) >>> 0;
}

/** SHA-256 over byte arrays — pure JS (FIPS 180-4). */
export function sha256(bytes: number[]): number[] {
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const bitLen = bytes.length * 8;
  const data = bytes.slice();
  data.push(0x80);
  while (data.length % 64 !== 56) data.push(0);
  const lenBytes: number[] = [];
  let rem = bitLen;
  for (let i = 0; i < 8; i++) {
    lenBytes.unshift(rem & 0xff);
    rem = Math.floor(rem / 256);
  }
  data.push(...lenBytes);

  const w: number[] = new Array(64);
  for (let off = 0; off < data.length; off += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] =
        ((data[off + t * 4] ?? 0) << 24) |
        ((data[off + t * 4 + 1] ?? 0) << 16) |
        ((data[off + t * 4 + 2] ?? 0) << 8) |
        (data[off + t * 4 + 3] ?? 0);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotl(w[t - 15]!, 7) ^ rotl(w[t - 15]!, 18) ^ (w[t - 15]! >>> 3);
      const s1 = rotl(w[t - 2]!, 17) ^ rotl(w[t - 2]!, 19) ^ (w[t - 2]! >>> 10);
      w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotl(e!, 6) ^ rotl(e!, 11) ^ rotl(e!, 25);
      const ch = (e! & f!) ^ (~e! & g!);
      const t1 = (h! + S1 + ch + K[t]! + w[t]!) >>> 0;
      const S0 = rotl(a!, 2) ^ rotl(a!, 13) ^ rotl(a!, 22);
      const maj = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e;
      e = (d! + t1) >>> 0;
      d = c; c = b; b = a;
      a = (t1 + t2) >>> 0;
    }
    const next = [a, b, c, d, e, f, g, h];
    for (let i = 0; i < 8; i++) H[i] = (H[i]! + next[i]!) >>> 0;
  }
  const out: number[] = [];
  for (const h of H) {
    out.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff);
  }
  return out;
}

function b64urlFromUtf8(str: string): string {
  return b64urlFromBytes(utf8Bytes(str));
}

/** Sign a Ghost Admin API token (5-minute window, aud /admin/). */
export function ghostJwt(adminKey: string): string {
  const sep = adminKey.indexOf(':');
  if (sep < 1) throw new Error('Admin API key looks wrong (expected id:secret).');
  const id = adminKey.slice(0, sep);
  const secret = bytesFromHex(adminKey.slice(sep + 1));
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlFromUtf8(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id }));
  const payload = b64urlFromUtf8(JSON.stringify({ iat: now, exp: now + 5 * 60, aud: '/admin/' }));
  const msg = utf8Bytes(`${header}.${payload}`);
  const sig = b64urlFromBytes(hmacSha256(secret, msg));
  return `${header}.${payload}.${sig}`;
}

export interface GhostIdentity {
  siteUrl: string;
  siteName: string;
}

export async function validateGhost(adminKey: string, siteUrl: string): Promise<GhostIdentity> {
  const key = adminKey.trim();
  const base = siteUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) throw new Error('Site URL must start with http(s).');
  let token: string;
  try {
    token = ghostJwt(key);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Bad Admin API key.');
  }
  let title = base.replace(/^https?:\/\//i, '');
  try {
    const res = await fetch(`${base}/ghost/api/admin/site/`, {
      headers: { Authorization: `Ghost ${token}` },
    });
    const json = (await res.json().catch(() => null)) as {
      site?: { title?: string };
      errors?: { message?: string }[];
    } | null;
    const err = json?.errors?.[0]?.message;
    if (!res.ok || err) throw new Error(err ?? `HTTP ${res.status}`);
    if (json?.site?.title) title = json.site.title;
  } catch (e) {
    throw new Error(
      `Ghost rejected those credentials: ${e instanceof Error ? e.message : 'unknown error'}. ` +
        'Check Integrations → your key in Ghost Admin, and that /ghost/api/ is reachable.',
    );
  }
  return { siteUrl: base, siteName: title };
}
