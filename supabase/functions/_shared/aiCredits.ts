// _shared/aiCredits.ts · canonical AI credit costs for the edge functions.
// Mirror of apps/web/src/lib/billing/aiCredits.ts — KEEP IN LOCKSTEP.

export type AiAction =
  | "rewrite" | "shorten" | "expand" | "tone" | "hashtags" | "idea"
  | "caption" | "post" | "adapt"
  | "thread" | "repurpose" | "variations"
  | "longform";

export const AI_CREDIT_COSTS: Record<AiAction, number> = {
  rewrite: 1, shorten: 1, expand: 1, tone: 1, hashtags: 1, idea: 1,
  caption: 2, post: 2, adapt: 2,
  thread: 3, repurpose: 3, variations: 3,
  longform: 5,
};

export function costOf(action: AiAction): number {
  return AI_CREDIT_COSTS[action] ?? 1;
}

export const AI_MODEL_ID = "gpt-4o-mini";
