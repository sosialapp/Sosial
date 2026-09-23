/**
 * Shared redesign building blocks — used identically on landing + dashboard
 * so a user never feels like they switched products. See redesign brief.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandIcon } from '@/components/BrandIcon';
import { providerMeta } from '@/lib/providers';
import type { ProviderKey } from '@/lib/types';

/** 1. Bolt stat card — one per screen max, only for real numbers. */
export function StatCard({
  value,
  label,
  href,
}: {
  value: string | number;
  label: string;
  href?: string;
}) {
  const cls = 'flex flex-col justify-between rounded-[20px] bg-ink p-5 text-paper';
  const inner = (
    <>
      <p className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-paper/70">{label}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${cls} transition hover:opacity-90`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/** 2. Channel pill — small chip per network with an accent dot. Same vocabulary
 *  in composer, calendar, analytics, dashboard, profile. */
export function ChannelPill({
  provider,
  handle,
  className = '',
}: {
  provider: ProviderKey | string;
  handle?: string | null;
  className?: string;
}) {
  const meta = providerMeta(provider);
  return (
    <span className={`channel-pill ${className}`}>
      <BrandIcon provider={provider as ProviderKey} className="h-4 w-4" />
      {handle ? <span className="truncate">@{handle}</span> : <span>{meta.label}</span>}
    </span>
  );
}

/** Compact stacked channel dots — replaces the old stacked-icon avatar circle
 *  in tight rows (upcoming post, recent sends). One chip per channel up to 4. */
export function ChannelStack({
  providers,
  max = 4,
}: {
  providers: ProviderKey[];
  max?: number;
}) {
  const shown = providers.slice(0, max);
  const extra = providers.length - shown.length;
  return (
    <span className="flex shrink-0 items-center" aria-label="Channels">
      {shown.map((pv, i) => (
        <span
          key={pv}
          className="rounded-full ring-2 ring-card"
          style={{ marginLeft: i === 0 ? 0 : -8, zIndex: shown.length - i }}
          title={providerMeta(pv).label}
        >
          <BrandIcon provider={pv} className="h-7 w-7" />
        </span>
      ))}
      {extra > 0 ? <span className="ml-1.5 text-xs font-bold text-muted">+{extra}</span> : null}
    </span>
  );
}

/** 3. Image placeholder slot — empty until the user uploads real assets.
 *  Renders a clean upload icon centered in a bordered paper-dim fill. */
export function ImageSlot({
  className = '',
  size = 'md',
  label,
}: {
  className?: string;
  /** 'sm' (thumbnails), 'md' (cards), 'lg' (hero/profile photo). */
  size?: 'sm' | 'md' | 'lg';
  /** Optional accessible label. */
  label?: string;
}) {
  const iconSize = size === 'lg' ? 'h-8 w-8' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const iconStroke = size === 'lg' ? 1.4 : 1.6;
  return (
    <div
      className={`image-slot ${className}`}
      role="img"
      aria-label={label ?? 'Image placeholder. Upload to fill'}
    >
      <svg
        viewBox="0 0 24 24"
        className={iconSize}
        fill="none"
        stroke="currentColor"
        strokeWidth={iconStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8.5v7M8.5 12h7" />
      </svg>
    </div>
  );
}

/** 4. Step marker — numbered 1/2/3, reserved for genuinely sequential content. */
export function StepMarker({ n }: { n: number | string }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink font-display text-xs font-extrabold text-paper">
      {n}
    </span>
  );
}

/** 5. CTA button — verb-first, no arrow glyph. Use 'ink' (default) for the
 *  single most important action per screen; 'bolt' for landing hero / new post;
 *  'ghost' for secondary. The verb reappears in the resulting toast. */
export function CTA({
  children,
  variant = 'ink',
  href,
  onClick,
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode;
  variant?: 'ink' | 'bolt' | 'ghost';
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const cls = `btn ${
    variant === 'bolt' ? 'btn-bolt' : variant === 'ghost' ? 'btn-ghost' : 'btn-primary'
  } ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} aria-disabled={disabled}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}
