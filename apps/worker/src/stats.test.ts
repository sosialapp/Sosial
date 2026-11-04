import { describe, expect, it } from 'vitest';
import { facebookStats, isFacebookVideoId, PostUnreadable } from './stats';

describe('isFacebookVideoId', () => {
  it('treats a bare numeric id as a video and page_post ids as posts', () => {
    expect(isFacebookVideoId('1234567890123456')).toBe(true);
    expect(isFacebookVideoId(' 1234567890 ')).toBe(true);
    expect(isFacebookVideoId('112233445566_998877665544')).toBe(false);
    expect(isFacebookVideoId('')).toBe(false);
  });
});

/** A fake Graph node: errors on the first requested field it does not have. */
const node = (has: Record<string, any>) => {
  const calls: string[] = [];
  const read = async (fields: string) => {
    calls.push(fields);
    const out: Record<string, any> = {};
    for (const f of fields.split(/,(?![^(]*\))/)) {
      const name = f.split('.')[0];
      if (!(name in has)) return { error: { code: 100, message: `(#100) Tried accessing nonexisting field (${f})` } };
      out[name] = has[name];
    }
    return out;
  };
  return { calls, read };
};

describe('facebookStats', () => {
  it('reads a page post in one call and takes off our own reaction', async () => {
    const { calls, read } = node({
      shares: { count: 2 },
      reactions: { summary: { total_count: 5, viewer_reaction: 'LIKE' } },
      comments: { summary: { total_count: 3 } },
    });
    const s = await facebookStats('111_222', read);
    expect(calls).toHaveLength(1);
    expect(s).toMatchObject({ likes: 4, comments: 3, shares: 2 });
    expect(s.note).toBeUndefined();
  });

  it('falls back to likes on a node without reactions, then skips the failing read', async () => {
    const { calls, read } = node({
      likes: { summary: { total_count: 7, has_liked: true } },
      comments: { summary: { total_count: 1 } },
    });
    const s = await facebookStats('333', read);
    expect(calls).toHaveLength(2);
    expect(s).toMatchObject({ likes: 6, comments: 1, shares: 0 });
    expect(s.note).toMatch(/likes, not all reactions/);
    await facebookStats('333', read);
    expect(calls).toHaveLength(3);
    expect(calls[2]).not.toMatch(/reactions/);
  });

  it('drops shares on a page-post id whose node has none', async () => {
    const { calls, read } = node({
      reactions: { summary: { total_count: 1 } },
      comments: { summary: { total_count: 0 } },
    });
    const s = await facebookStats('444_555', read);
    expect(calls).toHaveLength(2);
    expect(s.likes).toBe(1);
    expect(s.note).toMatch(/no share count/);
  });

  it('reports a deleted post as unreadable after one call', async () => {
    let calls = 0;
    const read = async () => {
      calls += 1;
      return { error: { code: 100, error_subcode: 33, message: 'Unsupported get request.' } };
    };
    await expect(facebookStats('666_777', read)).rejects.toBeInstanceOf(PostUnreadable);
    expect(calls).toBe(1);
  });

  it('throws other errors without more reads', async () => {
    let calls = 0;
    const read = async () => {
      calls += 1;
      return { error: { code: 190, message: 'Session has expired' } };
    };
    await expect(facebookStats('888_999', read)).rejects.toThrow('Session has expired');
    expect(calls).toBe(1);
  });

  it('keeps shares when the login lacks the reactions permission', async () => {
    const read = async (fields: string) =>
      fields === 'shares' ? { shares: { count: 4 } } : { error: { code: 10, message: 'Requires pages_read_user_content permission' } };
    const s = await facebookStats('121_343', read);
    expect(s.shares).toBe(4);
    expect(s.note).toMatch(/pages_read_user_content/);
  });
});
