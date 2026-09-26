import type { PostWithTargets } from './types';

/**
 * Chain grouping — threads/chains read as ONE post everywhere (calendar,
 * dashboard, queue). Head = lowest chain_position. Single source of truth
 * so the surfaces can never drift apart.
 */

/** Head of a chain's parts (lowest chain_position, then earliest time). */
export function chainHead(parts: PostWithTargets[]): PostWithTargets {
  return [...parts].sort(
    (a, b) =>
      a.chain_position - b.chain_position || (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''),
  )[0];
}

/** Chain parts grouped by chain_id. */
export function chainPartsByChain(posts: PostWithTargets[]): Map<string, PostWithTargets[]> {
  const m = new Map<string, PostWithTargets[]>();
  for (const p of posts) {
    if (!p.chain_id) continue;
    const arr = m.get(p.chain_id) ?? [];
    arr.push(p);
    m.set(p.chain_id, arr);
  }
  return m;
}

/** Only the head renders anywhere — parts collapse into it. */
export function isChainHead(p: PostWithTargets, parts: Map<string, PostWithTargets[]>): boolean {
  if (!p.chain_id) return true;
  return chainHead(parts.get(p.chain_id) ?? [p]).id === p.id;
}

/** Display size: sibling rows, or the worker thread length when a chain
 *  collapsed to its head (later parts carry no targets of their own). */
export function threadCount(p: PostWithTargets, parts: Map<string, PostWithTargets[]>): number {
  let n = p.chain_id ? (parts.get(p.chain_id)?.length ?? 1) : 1;
  for (const t of p.post_targets ?? []) {
    const th = t.options?.thread;
    if (Array.isArray(th)) {
      const c = th.filter((s) => typeof s === 'string' && s.trim()).length;
      if (c > n) n = c;
    }
  }
  return n;
}
