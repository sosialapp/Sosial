'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Pause, Play } from 'lucide-react';

export interface HeroQuestion {
  /** Headline pieces; `hl` pieces get the highlight chip. */
  parts: { t: string; hl?: boolean }[];
  slug: string;
  title: string;
}

/** Big rotating "How do I…?" headline, each answered by a docs page. Advances
 *  every few seconds via the active bar's CSS animation; pausable, and
 *  starts paused for reduced-motion users. */
export default function DocsHeroQuestions({ questions }: { questions: HeroQuestion[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) setPaused(true);
  }, []);

  const q = questions[i];
  if (!q) return null;
  const next = () => setI((n) => (n + 1) % questions.length);

  return (
    <div>
      <h1
        key={i}
        aria-live="polite"
        className="docs-hero-q mt-5 max-w-4xl font-display text-[2.1rem] font-medium leading-[1.15] tracking-tight sm:text-5xl sm:leading-[1.12] lg:text-[3.6rem]"
      >
        {q.parts.map((p, k) =>
          p.hl ? (
            <span key={k} className="rounded-xl bg-bolt px-2 text-on-accent [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
              {p.t}
            </span>
          ) : (
            <span key={k}>{p.t}</span>
          ),
        )}
      </h1>
      <p className="mt-6 flex flex-wrap items-center gap-x-2 text-lg text-ink/60">
        Answered in
        <Link
          href={`/${q.slug}`}
          className="group inline-flex items-center gap-1.5 font-medium text-ink underline decoration-bolt-deep decoration-2 underline-offset-4"
        >
          {q.title}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </p>
      {questions.length > 1 ? (
        <div className="mt-10 flex items-center justify-end gap-3 sm:mt-0 sm:absolute sm:bottom-10 sm:right-6 lg:right-10">
          <span className="text-xs text-ink/55">
            Question {i + 1} of {questions.length}
          </span>
          <div className="flex gap-1.5" role="tablist" aria-label="Example questions">
            {questions.map((_, k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={k === i}
                aria-label={`Question ${k + 1}`}
                onClick={() => setI(k)}
                className="relative h-1.5 w-5 overflow-hidden rounded-full bg-line sm:w-7"
              >
                {k < i ? <span className="absolute inset-0 bg-ink/60" /> : null}
                {k === i ? (
                  <span
                    key={i}
                    onAnimationEnd={next}
                    className="docs-hero-bar absolute inset-0 origin-left bg-ink"
                    style={{ animationPlayState: paused ? 'paused' : 'running' }}
                  />
                ) : null}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Play questions' : 'Pause questions'}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink/70 hover:bg-surface hover:text-ink"
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
        </div>
      ) : null}
    </div>
  );
}
