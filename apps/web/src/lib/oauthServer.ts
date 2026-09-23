/**
 * Server-only OAuth plumbing for the /api/oauth/* routes: flow cookies
 * (httpOnly, 10-minute) carrying the provider + workspace + PKCE verifier
 * across the provider round-trip. The `state` query param echoes the nonce
 * so a forged return URL can't be replayed into another flow.
 */
import type { OAuthProvider } from './oauth';

export const FLOW_COOKIE = 'sosial_oauth';
export const PICK_COOKIE = 'sosial_fb_pick';

export interface FlowState {
  provider: OAuthProvider;
  workspace_id: string;
  nonce: string;
  verifier?: string;
  /** Mastodon only: instance + per-instance app credentials. */
  instance?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface PickState {
  workspace_id: string;
  nonce: string;
  pages: {
    id: string;
    name: string;
    access_token: string;
    picture?: string;
    ig?: string;
  }[];
}

export const b64e = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url');

export function b64d<T>(s: string | undefined | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(Buffer.from(s, 'base64url').toString()) as T;
  } catch {
    return null;
  }
}

export function cookieOpts(origin: string): {
  httpOnly: boolean;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: origin.startsWith('https://'),
    path: '/',
    maxAge: 600,
  };
}
