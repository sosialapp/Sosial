'use client';

import { useEffect, useRef, useState } from 'react';
import { BrandIcon } from '@/components/BrandIcon';
import { ALL_PROVIDERS, PROVIDER_META } from '@/lib/providers';
import type { ProviderKey } from '@/lib/types';

/**
 * The hero's interactive centrepiece: ten channel marks ringed around the
 * Sosial bolt, wired to the centre with live spokes. Hover any logo for its
 * real limit; hit Publish and watch one post travel to every channel.
 */

const SIZE = 420;
const C = SIZE / 2;
const R = 160;
const FLIGHT_MS = 850;
const STAGGER_MS = 130;

const NODES = ALL_PROVIDERS.map((key, i) => {
  const a = (i / ALL_PROVIDERS.length) * Math.PI * 2 - Math.PI / 2;
  return { key, x: C + R * Math.cos(a), y: C + R * Math.sin(a) };
});

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export default function HeroOrbit() {
  const [hovered, setHovered] = useState<ProviderKey | null>(null);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [sentCount, setSentCount] = useState(0);
  const [lit, setLit] = useState<Set<ProviderKey>>(new Set());
  const dots = useRef(new Map<ProviderKey, SVGCircleElement>());
  const timers = useRef<number[]>([]);
  const raf = useRef(0);
  const played = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(raf.current);
    },
    [],
  );

  const arrive = (key: ProviderKey) => {
    setLit((prev) => new Set(prev).add(key));
    setSentCount((c) => c + 1);
  };

  const flyTo = (node: { key: ProviderKey; x: number; y: number }) => {
    const dot = dots.current.get(node.key);
    if (!dot) {
      arrive(node.key);
      return;
    }
    dot.style.opacity = '1';
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / FLIGHT_MS);
      const eased = 1 - Math.pow(1 - k, 3);
      dot.setAttribute('cx', String(C + (node.x - C) * eased));
      dot.setAttribute('cy', String(C + (node.y - C) * eased));
      if (k < 1) {
        raf.current = requestAnimationFrame(step);
      } else {
        dot.style.opacity = '0';
        arrive(node.key);
      }
    };
    raf.current = requestAnimationFrame(step);
  };

  const publish = () => {
    if (phase === 'sending') return;
    if (prefersReducedMotion()) {
      setLit(new Set(ALL_PROVIDERS));
      setSentCount(ALL_PROVIDERS.length);
      setPhase('sent');
      timers.current.push(
        window.setTimeout(() => {
          setPhase('idle');
          setLit(new Set());
          setSentCount(0);
        }, 2600),
      );
      return;
    }
    setPhase('sending');
    setLit(new Set());
    setSentCount(0);
    NODES.forEach((n, i) => {
      timers.current.push(window.setTimeout(() => flyTo(n), i * STAGGER_MS));
    });
    timers.current.push(
      window.setTimeout(
        () => {
          setPhase('sent');
          timers.current.push(
            window.setTimeout(() => {
              setPhase('idle');
              setLit(new Set());
              setSentCount(0);
            }, 2600),
          );
        },
        NODES.length * STAGGER_MS + FLIGHT_MS + 150,
      ),
    );
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || played.current || prefersReducedMotion()) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          played.current = true;
          publish();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hoveredMeta = hovered ? PROVIDER_META[hovered] : null;
  const readout = hoveredMeta
    ? `${hoveredMeta.label} · ${hoveredMeta.limit.toLocaleString()} characters`
    : phase === 'sent'
      ? 'All ten channels got it.'
      : phase === 'sending'
        ? 'Watch it travel.'
        : 'Hover a logo — or hit Publish.';

  return (
    <div
      ref={wrapRef}
      className="w-full rounded-3xl border border-line bg-card p-4 shadow-[0_24px_60px_-30px_rgba(28,25,23,0.35)] md:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="pill bg-accent-soft text-accent-ink">Interactive demo</span>
        <span className="text-xs font-bold text-faint">One post → ten channels</span>
      </div>

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mt-1 w-full" role="img" aria-label="Ten social channels connected to Sosial">
        {NODES.map((n) => (
          <line
            key={n.key}
            x1={C}
            y1={C}
            x2={n.x}
            y2={n.y}
            className="orbit-spoke stroke-line"
            strokeWidth={1.5}
          />
        ))}

        {NODES.map((n) => (
          <circle
            key={`dot-${n.key}`}
            ref={(el) => {
              if (el) dots.current.set(n.key, el);
              else dots.current.delete(n.key);
            }}
            cx={C}
            cy={C}
            r={5}
            className="fill-accent"
            opacity={0}
          />
        ))}

        <g
          onClick={publish}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              publish();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Publish to all channels"
          className="cursor-pointer"
        >
          <title>Publish to all channels</title>
          <circle cx={C} cy={C} r={42} className="fill-accent-soft" />
          <circle
            cx={C}
            cy={C}
            r={42}
            fill="none"
            className="stroke-accent"
            strokeWidth={2}
            opacity={phase === 'sending' ? 0.9 : 0.25}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <image href="/bolt.png" x={C - 23} y={C - 23} width={46} height={46} />
        </g>

        {NODES.map((n) => {
          const meta = PROVIDER_META[n.key];
          const active = hovered === n.key || lit.has(n.key);
          return (
            <a key={n.key} href={`/integrations/${n.key}`} aria-label={`${meta.label} integration`}>
              <g transform={`translate(${n.x} ${n.y})`}>
                <g
                  onMouseEnter={() => setHovered(n.key)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(n.key)}
                  onBlur={() => setHovered(null)}
                  className="cursor-pointer"
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transform: active ? 'scale(1.18)' : undefined,
                    transition: 'transform 0.18s ease',
                  }}
                >
                  <circle
                    r={18}
                    fill="#ffffff"
                    className={active ? 'stroke-accent' : 'stroke-line'}
                    strokeWidth={active ? 2.5 : 1.5}
                  />
                  <g transform="translate(-10 -10)">
                    <BrandIcon provider={n.key} className="h-5 w-5" />
                  </g>
                </g>
              </g>
            </a>
          );
        })}
      </svg>

      <div className="mt-1 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={publish}
          disabled={phase === 'sending'}
          className="btn btn-primary"
        >
          {phase === 'sending'
            ? `Publishing… ${sentCount}/10`
            : phase === 'sent'
              ? 'Published ✓'
              : 'Publish to 10 channels'}
        </button>
        <p className="text-xs font-semibold text-muted" aria-live="polite">
          {readout}
        </p>
      </div>
    </div>
  );
}
