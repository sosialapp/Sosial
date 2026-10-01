/**
 * Inbox reply plumbing (pure — testable). Replies stay ordinary posts: the
 * platform message id rides post_targets.options, so the queue, scheduler
 * and worker carry replies with no new pipeline.
 */

export const REPLY_OPTION = 'replyTo';

/** Target options for one reply, e.g. { discord: { replyTo: '123' } }. */
export function replyTargetOptions(provider: string, replyTo: string): Record<string, Record<string, unknown>> {
  return { [provider]: { [REPLY_OPTION]: replyTo } };
}

/** Read a reply reference back out of stored target options. */
export function replyToOf(options: Record<string, unknown> | null | undefined): string | null {
  if (!options || typeof options !== 'object') return null;
  const v = (options as Record<string, unknown>)[REPLY_OPTION];
  return typeof v === 'string' && v ? v : null;
}
