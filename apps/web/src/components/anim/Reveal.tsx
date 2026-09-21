'use client';

import { useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Staggered scroll-in for a group of children.
 *
 * Progressive enhancement: nothing is hidden in the markup, so the content is
 * fully readable with JavaScript disabled, before hydration, and for anyone
 * who prefers reduced motion. GSAP only *adds* the entrance.
 */
export default function Reveal({
  children,
  className,
  y = 26,
  stagger = 0.08,
  delay = 0,
  start = 'top 88%',
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  stagger?: number;
  delay?: number;
  start?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const items = Array.from(root.children) as HTMLElement[];
      if (!items.length) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          items,
          { autoAlpha: 0, y },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.66,
            ease: 'power3.out',
            stagger,
            delay,
            scrollTrigger: { trigger: root, start, once: true },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
