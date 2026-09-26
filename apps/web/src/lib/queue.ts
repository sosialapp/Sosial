/**
 * Queue lead-time rule — mobile parity (MIN_QUEUE_LEAD_MS in
 * src/utils/managed.ts). Scheduled posts need >= 5 minutes of lead so the
 * worker never receives a target that is already overdue on arrival.
 * Applies to user-picked schedule times only: post-now, drafts and
 * chain-now parts queue immediately by design and skip this check.
 */
export const MIN_QUEUE_LEAD_MS = 5 * 60 * 1000;

/**
 * Earliest queueable instant, floored to the minute — pickers are
 * minute-granular, so without flooring the exact +5min minute would almost
 * always be (seconds-)blocked. 7:51:37 -> 7:56:00 allowed, 7:55 blocked.
 */
export function minQueueTime(now: number = Date.now()): number {
  return Math.floor((now + MIN_QUEUE_LEAD_MS) / 60000) * 60000;
}

/** True when the picked instant is too close (or unparseable) to queue. */
export function queueTooSoon(at: number | string, now: number = Date.now()): boolean {
  const t = typeof at === 'string' ? new Date(at).getTime() : at;
  return Number.isNaN(t) || t < minQueueTime(now);
}

/** "7:56" style label for the guard messages. */
export function minQueueLabel(now: number = Date.now()): string {
  try {
    return new Date(minQueueTime(now)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '5 minutes from now';
  }
}

/** The exact guard sentence the mobile app shows (kept identical). */
export function leadTimeMessage(now: number = Date.now()): string {
  return `Earliest is ${minQueueLabel(now)} — scheduled posts need at least 5 minutes lead time. Pick a later time.`;
}

/** Throw for a missing, unparseable or too-soon schedule instant. */
export function assertQueueLeadTime(iso: string | null, now: number = Date.now()): void {
  if (!iso) throw new Error('Choose a valid date and time.');
  if (queueTooSoon(iso, now)) throw new Error(leadTimeMessage(now));
}
