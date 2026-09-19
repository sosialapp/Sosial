import { afterEach, describe, expect, it } from 'vitest';
import { callbackUrl, oauthErrorMessage, safeNextPath } from './auth';

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe('callbackUrl', () => {
  it('uses the current origin when no site URL is set', () => {
    expect(callbackUrl('http://localhost:3000')).toBe('http://localhost:3000/auth/callback');
  });

  it('prefers NEXT_PUBLIC_SITE_URL when set', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://sosial.app';
    expect(callbackUrl('http://localhost:3000')).toBe('https://sosial.app/auth/callback');
  });

  it('trims trailing slashes and whitespace', () => {
    process.env.NEXT_PUBLIC_SITE_URL = '  https://sosial.app/  ';
    expect(callbackUrl('http://localhost:3000')).toBe('https://sosial.app/auth/callback');
  });

  it('ignores a blank site URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = '   ';
    expect(callbackUrl('http://localhost:3000')).toBe('http://localhost:3000/auth/callback');
  });
});

describe('oauthErrorMessage', () => {
  it('returns null when there is no error', () => {
    expect(oauthErrorMessage(null)).toBeNull();
    expect(oauthErrorMessage(undefined)).toBeNull();
    expect(oauthErrorMessage('')).toBeNull();
  });

  it('explains an interrupted OAuth return', () => {
    const msg = oauthErrorMessage('oauth');
    expect(msg).toMatch(/interrupted/i);
  });

  it('falls back to a generic message for unknown codes', () => {
    expect(oauthErrorMessage('weird')).toMatch(/went wrong/i);
  });
});

describe('safeNextPath', () => {
  it('passes through relative app paths', () => {
    expect(safeNextPath('/queue')).toBe('/queue');
    expect(safeNextPath('/calendar')).toBe('/calendar');
  });

  it('rejects absolute URLs, protocol-relative URLs and junk', () => {
    expect(safeNextPath('https://evil.example')).toBe('/calendar');
    expect(safeNextPath('//evil.example/x')).toBe('/calendar');
    expect(safeNextPath('')).toBe('/calendar');
    expect(safeNextPath(null)).toBe('/calendar');
    expect(safeNextPath(undefined)).toBe('/calendar');
  });
});
