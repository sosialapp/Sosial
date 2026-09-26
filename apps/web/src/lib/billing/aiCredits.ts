/**
 * Canonical AI credit costs — the ONE source of truth for what each AI action
 * costs. Server gates, UI previews and the upgrade prompt all read this table.
 *
 * A "credit" is the only AI unit the product exposes. Model tokens, provider
 * cost and margin are internal and never shown to the user.
 */

export type AiAction =
  | 'rewrite'
  | 'shorten'
  | 'expand'
  | 'tone'
  | 'hashtags'
  | 'idea'
  | 'caption'
  | 'post'
  | 'adapt'
  | 'thread'
  | 'repurpose'
  | 'variations'
  | 'longform';

/** Credits consumed per completed generation, by action. */
export const AI_CREDIT_COSTS: Record<AiAction, number> = {
  // light edits — 1 credit
  rewrite: 1,
  shorten: 1,
  expand: 1,
  tone: 1,
  hashtags: 1,
  idea: 1,
  // standard generation — 2 credits
  caption: 2,
  post: 2,
  adapt: 2,
  // heavier generation — 3 credits
  thread: 3,
  repurpose: 3,
  variations: 3,
  // long-form — 5 credits
  longform: 5,
};

export const AI_ACTIONS = Object.keys(AI_CREDIT_COSTS) as AiAction[];

export function isAiAction(v: unknown): v is AiAction {
  return typeof v === 'string' && v in AI_CREDIT_COSTS;
}

/** Human label for a credit-carrying action (usage history, previews). */
export const AI_ACTION_LABELS: Record<AiAction, string> = {
  rewrite: 'Rewrite',
  shorten: 'Shorten',
  expand: 'Expand',
  tone: 'Tone change',
  hashtags: 'Hashtags',
  idea: 'Content idea',
  caption: 'Generate caption',
  post: 'Generate post',
  adapt: 'Platform adaptation',
  thread: 'Thread',
  repurpose: 'Repurposing',
  variations: 'Variations',
  longform: 'Long-form generation',
};

export function costOf(action: AiAction): number {
  return AI_CREDIT_COSTS[action];
}

/** The AI is branded to users as a single named assistant. */
export const AI_MODEL_LABEL = 'GPT-5.6 Luna';
/** The provider model actually called today (internal only, never shown). */
export const AI_MODEL_ID = 'gpt-4o-mini';
