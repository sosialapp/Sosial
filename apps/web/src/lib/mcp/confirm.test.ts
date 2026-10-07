import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mcpConfirmGuard } from './confirm';

/** Minimal fake of the supabase .from() surface for mcp_confirmations. */
function fakeDb() {
  const rows: Record<string, any>[] = [];
  const db = {
    rows,
    from(table: string) {
      expect(table).toBe('mcp_confirmations');
      return {
        insert(row: any) {
          rows.push({ ...row });
          return { error: null };
        },
        select(_cols: string) {
          const match: Record<string, unknown> = {};
          const q = {
            eq(col: string, val: unknown) {
              match[col] = val;
              return q;
            },
            maybeSingle() {
              return {
                data:
                  rows.find((r) => Object.entries(match).every(([k, v]) => r[k] === v)) ?? null,
              };
            },
          };
          return q;
        },
        delete() {
          const q = {
            eq(col: string, val: unknown) {
              for (let i = rows.length - 1; i >= 0; i--) {
                if (rows[i][col] === val) rows.splice(i, 1);
              }
              return q;
            },
          };
          return q;
        },
      };
    },
  };
  return db;
}

const WS = 'ws-1';
const KEY = 'key-1';

describe('mcpConfirmGuard', () => {
  it('requires confirmation on first call and issues a token', async () => {
    const guard = mcpConfirmGuard(fakeDb() as never, WS, KEY);
    const c = await guard.check('delete_post', { post_id: 'p1' }, async () => 'Delete post "x"', true, undefined);
    expect(c.required).toBe(true);
    expect(c.token).toBeTruthy();
    expect(c.summary).toBe('Delete post "x"');
    expect(c.expiresIn).toBe(300);
  });

  it('executes on the second call with the token + identical args', async () => {
    const db = fakeDb();
    const guard = mcpConfirmGuard(db as never, WS, KEY);
    const args = { post_id: 'p1' };
    const first = await guard.check('delete_post', args, () => 'Delete', true, undefined);
    const second = await guard.check('delete_post', args, () => 'Delete', true, first.token);
    expect(second.required).toBe(false);
  });

  it('rejects a reused (single-use) token', async () => {
    const db = fakeDb();
    const guard = mcpConfirmGuard(db as never, WS, KEY);
    const args = { post_id: 'p1' };
    const first = await guard.check('delete_post', args, () => 'Delete', true, undefined);
    await guard.check('delete_post', args, () => 'Delete', true, first.token);
    const third = await guard.check('delete_post', args, () => 'Delete', true, first.token);
    expect(third.required).toBe(true);
    expect(third.message).toMatch(/invalid or was already used/i);
  });

  it('binds the token to the exact arguments', async () => {
    const db = fakeDb();
    const guard = mcpConfirmGuard(db as never, WS, KEY);
    const first = await guard.check('delete_post', { post_id: 'p1' }, () => 'Delete', true, undefined);
    const wrong = await guard.check('delete_post', { post_id: 'p2' }, () => 'Delete', true, first.token);
    expect(wrong.required).toBe(true);
    expect(wrong.message).toMatch(/arguments changed/i);
  });

  it('binds the token to the tool', async () => {
    const db = fakeDb();
    const guard = mcpConfirmGuard(db as never, WS, KEY);
    const first = await guard.check('delete_post', { post_id: 'p1' }, () => 'Delete', true, undefined);
    const wrongTool = await guard.check('unschedule_post', { post_id: 'p1' }, () => 'Unschedule', true, first.token);
    expect(wrongTool.required).toBe(true);
  });

  it('rejects expired tokens', async () => {
    const db = fakeDb();
    const guard = mcpConfirmGuard(db as never, WS, KEY);
    const args = { post_id: 'p1' };
    const first = await guard.check('delete_post', args, () => 'Delete', true, undefined);
    // Age the row past its TTL
    db.rows.forEach((r) => (r.expires_at = new Date(Date.now() - 1000).toISOString()));
    const second = await guard.check('delete_post', args, () => 'Delete', true, first.token);
    expect(second.required).toBe(true);
    expect(second.message).toMatch(/expired/i);
  });

  it('isolates confirmations per workspace + key', async () => {
    const db = fakeDb();
    const guardA = mcpConfirmGuard(db as never, 'ws-a', KEY);
    const guardB = mcpConfirmGuard(db as never, 'ws-b', KEY);
    const first = await guardA.check('delete_post', { post_id: 'p1' }, () => 'Delete', true, undefined);
    const cross = await guardB.check('delete_post', { post_id: 'p1' }, () => 'Delete', true, first.token);
    expect(cross.required).toBe(true);
  });
});
