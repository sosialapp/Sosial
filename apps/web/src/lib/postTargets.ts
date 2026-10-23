import type { PostTargetRow, TargetStatus } from './types';

/** Best-to-worst: the destination that actually carried the post wins over a
 *  sibling that failed or is still waiting. */
const TARGET_PRIORITY: TargetStatus[] = [
  'sent',
  'publishing',
  'queued',
  'needs_approval',
  'pending',
  'failed',
  'skipped',
];

/** The target a post row should speak for.
 *
 *  PostgREST returns nested targets in no guaranteed order, so `targets[0]`
 *  can be the destination that failed while the post went out on the other
 *  three. Pick by outcome instead: sent, then in-flight, then anything. */
export function primaryTarget(post: { post_targets?: PostTargetRow[] | null }): PostTargetRow | null {
  const list = post.post_targets ?? [];
  if (list.length === 0) return null;
  if (list.length === 1) return list[0] ?? null;
  for (const want of TARGET_PRIORITY) {
    const hit = list.find((t) => t.status === want);
    if (hit) return hit;
  }
  return list[0] ?? null;
}
