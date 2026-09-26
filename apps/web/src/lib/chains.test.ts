import { describe, expect, it } from 'vitest';
import { chainHead, chainPartsByChain, isChainHead, threadCount } from './chains';
import type { PostWithTargets } from './types';

function post(
  id: string,
  extra: Partial<PostWithTargets> = {},
): PostWithTargets {
  return {
    id,
    workspace_id: 'w',
    created_by: 'u',
    client_id: `c_${id}`,
    title: '',
    body: `body ${id}`,
    status: 'queued',
    scheduled_at: '2026-09-26T12:00:00.000Z',
    timezone: null,
    chain_id: null,
    chain_position: 0,
    created_at: '2026-09-26T11:00:00.000Z',
    updated_at: '2026-09-26T11:00:00.000Z',
    sent_at: null,
    post_targets: [],
    post_media: [],
    ...extra,
  } as PostWithTargets;
}

describe('chain grouping', () => {
  it('picks the lowest chain_position as head', () => {
    const parts = [post('b', { chain_id: 'c', chain_position: 1 }), post('a', { chain_id: 'c', chain_position: 0 })];
    expect(chainHead(parts).id).toBe('a');
    const map = chainPartsByChain(parts);
    expect(isChainHead(parts[0], map)).toBe(false);
    expect(isChainHead(parts[1], map)).toBe(true);
    expect(isChainHead(post('solo'), map)).toBe(true);
  });

  it('counts sibling rows, falling back to options.thread', () => {
    const parts = [
      post('a', { chain_id: 'c', chain_position: 0 }),
      post('b', { chain_id: 'c', chain_position: 1 }),
    ];
    const map = chainPartsByChain(parts);
    expect(threadCount(parts[0], map)).toBe(2);
    // Collapsed chain: head alone, thread length on the target.
    const head = post('h', {
      chain_id: 'c2',
      post_targets: [{ options: { thread: ['one', 'two', 'three', 'four'] } }] as never,
    });
    expect(threadCount(head, new Map())).toBe(4);
    expect(threadCount(post('solo'), new Map())).toBe(1);
  });
});
