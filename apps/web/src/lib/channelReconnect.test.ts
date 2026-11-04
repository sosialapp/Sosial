import { describe, expect, it } from 'vitest';
import { commentsBlocked, skipTokenImport } from './channelReconnect';

describe('skipTokenImport', () => {
  it('skips a live channel that has nothing wrong', () => {
    expect(skipTokenImport({ status: 'connected', metadata: { avatar: 'a.png' } })).toBe(true);
    expect(skipTokenImport({ status: 'connected' })).toBe(true);
  });

  it('imports over a live channel whose comments are blocked', () => {
    expect(skipTokenImport({ status: 'connected', metadata: { commentsBlocked: true } })).toBe(false);
  });

  it('imports for a new account', () => {
    expect(skipTokenImport(null)).toBe(false);
    expect(skipTokenImport(undefined)).toBe(false);
  });

  it('imports over rows that are not live', () => {
    expect(skipTokenImport({ status: 'expired' })).toBe(false);
    expect(skipTokenImport({ status: 'revoked', metadata: { commentsBlocked: true } })).toBe(false);
  });
});

describe('commentsBlocked', () => {
  it('reads only a true flag', () => {
    expect(commentsBlocked({ commentsBlocked: true })).toBe(true);
    expect(commentsBlocked({ commentsBlocked: false })).toBe(false);
    expect(commentsBlocked({ commentsBlocked: 'true' })).toBe(false);
    expect(commentsBlocked({})).toBe(false);
    expect(commentsBlocked(null)).toBe(false);
  });
});
