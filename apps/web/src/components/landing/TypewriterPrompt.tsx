'use client';

import { useEffect, useState } from 'react';

/**
 * Typewriter that cycles through prompt lines: holds, deletes, types the
 * next. Server-renders the first line so no-JS and crawlers see content;
 * frozen (first line) under reduced motion.
 */
export default function TypewriterPrompt({
  texts,
  className = '',
  onPhase,
}: {
  texts: string[];
  className?: string;
  /** True while a finished line holds ("generating"), false while typing. */
  onPhase?: (generating: boolean) => void;
}) {
  const [output, setOutput] = useState(texts[0] ?? '');

  useEffect(() => {
    if (texts.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let line = 0;
    let count = texts[0]?.length ?? 0;
    let phase: 'hold' | 'deleting' | 'typing' = 'hold';
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (phase === 'hold') {
        phase = 'deleting';
        timer = setTimeout(step, 2000);
        return;
      }
      if (phase === 'deleting') {
        const full = texts[line] ?? '';
        if (count > 0) {
          count -= 1;
          setOutput(full.slice(0, count));
          timer = setTimeout(step, 26);
        } else {
          line = (line + 1) % texts.length;
          phase = 'typing';
          onPhase?.(false);
          timer = setTimeout(step, 350);
        }
        return;
      }
      const target = texts[line] ?? '';
      if (count < target.length) {
        count += 1;
        setOutput(target.slice(0, count));
        timer = setTimeout(step, 40 + Math.random() * 60);
      } else {
        phase = 'hold';
        onPhase?.(true);
        timer = setTimeout(step, 2000);
      }
    };
    timer = setTimeout(step, 2000);
    return () => clearTimeout(timer);
  }, [texts, onPhase]);

  return (
    <p className={className}>
      <span className="sr-only">{texts[0]}</span>
      <span aria-hidden="true">{output}</span>
      <span
        aria-hidden="true"
        className="ml-0.5 inline-block h-4 w-[2px] translate-y-[2px] animate-pulse bg-white/80"
      />
    </p>
  );
}
