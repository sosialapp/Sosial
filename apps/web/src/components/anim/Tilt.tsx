'use client';

import { useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Pointer-tracked 3D tilt. Desktop + fine-pointer only, and skipped entirely
 * under reduced motion — the card is flat and static everywhere else.
 */
export default function Tilt({
  children,
  className = '',
  max = 6,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      mm.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
        const rx = gsap.quickTo(el, 'rotationX', { duration: 0.45, ease: 'power3' });
        const ry = gsap.quickTo(el, 'rotationY', { duration: 0.45, ease: 'power3' });

        const onMove = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          ry(px * max * 2);
          rx(-py * max * 2);
        };
        const onLeave = () => {
          rx(0);
          ry(0);
        };

        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
        return () => {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerleave', onLeave);
        };
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={`[transform-style:preserve-3d] ${className}`}>
      {children}
    </div>
  );
}
