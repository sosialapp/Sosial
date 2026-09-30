import { describe, expect, it } from 'vitest';
import { apiClientId, bearerKey, generateApiKey, hashApiKey, isValidIdempotencyKey } from './apiKeys';

describe('apiKeys', () => {
  it('generates unique live keys with matching hashes', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).toMatch(/^sos_live_[A-Za-z0-9_-]{43}$/);
    expect(a.key).not.toBe(b.key);
    expect(a.hash).toBe(hashApiKey(a.key));
    expect(a.prefix).toBe(a.key.slice(0, 17));
  });

  it('parses bearer headers', () => {
    expect(bearerKey('Bearer sos_live_abc')).toBe('sos_live_abc');
    expect(bearerKey('bearer sos_live_abc')).toBe('sos_live_abc');
    expect(bearerKey('Basic abc')).toBeNull();
    expect(bearerKey(null)).toBeNull();
  });

  it('namespaces idempotency keys per api key', () => {
    expect(apiClientId('kid', 'order-1')).toBe('api:kid:order-1');
    expect(isValidIdempotencyKey('order-1_x')).toBe(true);
    expect(isValidIdempotencyKey('https://example.com/item/42')).toBe(true);
    expect(isValidIdempotencyKey('no spaces')).toBe(false);
    expect(isValidIdempotencyKey('')).toBe(false);
    expect(isValidIdempotencyKey(42)).toBe(false);
  });
});
