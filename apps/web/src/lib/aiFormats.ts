/**
 * AI Generate structure presets: named content shapes the model follows so a
 * short topic is enough. `detectFormat` guesses the shape from the topic with
 * cheap client-side pattern matching (no AI call, no credits) — the card
 * surfaces it as a one-tap suggestion, never an auto-apply.
 */

export type AiFormatId = 'breakdown' | 'howto' | 'story';

export interface AiFormat {
  id: AiFormatId;
  label: string;
  blurb: string;
  /** Injected ahead of the user's own custom instructions. */
  instructions: string;
}

export const AI_FORMATS: AiFormat[] = [
  {
    id: 'breakdown',
    label: 'Breakdown',
    blurb: 'One era per post, same beats, running total, conclusion last.',
    instructions:
      'Structure: era-by-era breakdown chain. Cover one era per post in chronological order. ' +
      'Every post follows the same beats: the starting point, the numbers, one key event, ' +
      'the market condition in one line, and the running total so far. The final post is the ' +
      'conclusion: the grand total, the biggest lesson, one takeaway line. ' +
      'Same voice throughout; never repeat the setup.',
  },
  {
    id: 'howto',
    label: 'How-to',
    blurb: 'One step per post, recap checklist at the end.',
    instructions:
      'Structure: practical how-to. One step per post, in order. Each post covers exactly one ' +
      'step: what to do, why it works, and one concrete example or mistake to avoid. ' +
      'The final post is a quick recap checklist plus the one thing to do first today. ' +
      'Direct second-person voice, no fluff.',
  },
  {
    id: 'story',
    label: 'Story',
    blurb: 'Hook, turning points in order, lesson at the end.',
    instructions:
      'Structure: personal story arc. First post: the hook — where things stood and what was ' +
      'at stake. Middle posts: what happened in order, one turning point each, honest about ' +
      'setbacks. Final post: where things stand now and the one lesson for your past self. ' +
      'First-person voice, specific details over generalities.',
  },
];

const RULES: { id: AiFormatId; res: RegExp[] }[] = [
  {
    id: 'breakdown',
    res: [
      /(19|20)\d{2}\s*[–—-]\s*(19|20)\d{2}/, // 2010-2026
      /\bsince\s+(19|20)\d{2}\b/,
      /\bfrom\b.{0,32}\b(19|20)\d{2}\b/,
      /\bevery\s+(month|week|day|year)\b/,
      /\bper\s+(month|week|year)\b/,
      /\b(all|over|last|past)\s+(the\s+)?\d+\s+years?\b/,
      /\byear[-\s]?by[-\s]?year\b/,
      /\b(each|every)\s+year\b/,
      /\bbreakdown\b/,
      /\btimeline\b/,
      /\bhistory\s+of\b/,
      /\bevolution\s+of\b/,
      /\bretrospective\b/,
      /\bdca\b/,
      /\bdollar[-\s]?cost\b/,
      /\bwhat\s+if\s+(you|i|we)\b/,
      /\bhow\s+much\b.{0,24}\b(made|worth|earn|grow)\b/,
      /\bworth\s+(today|now)\b/,
    ],
  },
  {
    id: 'howto',
    res: [
      /^\s*how\s+to\b/,
      /\bstep[-\s]?by[-\s]?step\b/,
      /\bguide\s+to\b/,
      /\btutorial\b/,
      /\bchecklist\b/,
      /\bplaybook\b/,
      /\bcrash\s+course\b/,
      /\btips\s+(for|on|to)\b/,
      /\blearn\s+to\b/,
      /\bfor\s+beginners\b/,
      /\bhow\s+(do|can|should)\s+i\b/,
    ],
  },
  {
    id: 'story',
    res: [
      /\bhow\s+i\b/,
      /\bhow\s+we\b/,
      /\bmy\s+(journey|story|mistake|lesson|confession)\b/,
      /\bstory\s+of\b/,
      /\bbehind\s+the\s+scenes\b/,
      /\bi\s+(built|started|went\s+from|quit|left|moved|failed)\b/,
      /\bwhat\s+i\s+(learned|wish\s+i\s+knew)\b/,
      /\blessons?\s+learned\b/,
      /\bmistakes?\b/,
    ],
  },
];

/**
 * Guess the structure preset for a topic. Highest rule-hit count wins;
 * ties break toward breakdown (its date/cadence signals are the most
 * structural). Returns null for short or unmatched topics.
 */
export function detectFormat(topic: string): AiFormatId | null {
  const t = topic.trim().toLowerCase();
  if (t.length < 12) return null;
  let best: AiFormatId | null = null;
  let bestScore = 0;
  for (const { id, res } of RULES) {
    let score = 0;
    for (const re of res) {
      if (re.test(t)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}
