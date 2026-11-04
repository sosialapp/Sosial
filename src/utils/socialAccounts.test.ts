import { describe, expect, it } from 'vitest';
import { accountCommentsBlocked, commentsBlockedKeys, type ConnectedAccount } from './socialAccounts';

describe('commentsBlockedKeys', () => {
  it('keeps only rows the worker flagged', () => {
    const keys = commentsBlockedKeys([
      { provider: 'youtube', external_id: 'a', metadata: { commentsBlocked: true } },
      { provider: 'youtube', external_id: 'b', metadata: { avatar: 'x' } },
      { provider: 'youtube', external_id: 'c', metadata: null },
    ]);
    expect([...keys]).toEqual(['youtube:a']);
  });
});

describe('accountCommentsBlocked', () => {
  const account = (fields: Record<string, unknown>) => ({ fields }) as unknown as ConnectedAccount;

  it('reads the stamp from the pull', () => {
    expect(accountCommentsBlocked(account({ cloudCommentsBlocked: true }))).toBe(true);
    expect(accountCommentsBlocked(account({}))).toBe(false);
  });
});
