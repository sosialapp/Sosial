import { afterEach, describe, expect, it } from 'vitest';
import { publicOrigin } from './site';

const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

describe('publicOrigin', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('uses the proxy host, never the container bind address', () => {
    const r = req('https://0.0.0.0:3000/api/oauth/start', {
      'x-forwarded-host': 'sosial.app',
      'x-forwarded-proto': 'https',
      host: '0.0.0.0:3000',
    });
    expect(publicOrigin(r)).toBe('https://sosial.app');
  });

  it('falls back to the Host header', () => {
    expect(publicOrigin(req('https://0.0.0.0:3000/x', { host: 'sosial.app' }))).toBe('https://sosial.app');
  });

  it('falls back to NEXT_PUBLIC_SITE_URL when only the bind address is known', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://sosial.app/';
    expect(publicOrigin(req('https://0.0.0.0:3000/x', { host: '0.0.0.0:3000' }))).toBe('https://sosial.app');
  });

  it('keeps localhost in development', () => {
    expect(publicOrigin(req('http://localhost:3005/x', { host: 'localhost:3005' }))).toBe('http://localhost:3005');
  });
});
