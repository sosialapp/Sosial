'use client';

import { useState } from 'react';
import TypewriterPrompt from '@/components/landing/TypewriterPrompt';

const PROMPTS = [
  'Write a content about AI will replace human.',
  'Write a latest news about global economy.',
];

/**
 * AI prompt box: star while the line types, circle loader while the
 * finished line holds ("generating"). Owns the phase state so the button
 * icon stays in sync with the typewriter.
 */
export default function AiPromptBox() {
  const [generating, setGenerating] = useState(true);
  return (
    <div className="w-full rounded-xl bg-black/25 p-4">
      <TypewriterPrompt
        texts={PROMPTS}
        onPhase={setGenerating}
        className="min-h-[3.25rem] rounded-lg border border-white/15 bg-black/30 px-4 py-3 font-display text-sm text-white/90"
      />
      <p className="relative mt-3 flex items-center justify-center gap-2 overflow-hidden rounded-full bg-white py-2.5 font-display text-sm font-bold text-black">
        <span
          aria-hidden="true"
          className="animate-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-black/10 to-transparent"
        />
        {generating ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black"
          />
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="currentColor">
            <path d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10Z" />
          </svg>
        )}
        Generate
      </p>
    </div>
  );
}
