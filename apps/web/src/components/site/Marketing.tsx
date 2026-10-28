import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Check, type LucideIcon } from 'lucide-react';
import Reveal from '@/components/anim/Reveal';

/**
 * Building blocks for the product and company pages (Publish, Create, AI
 * Assistant, Compare, Made for everyone, Transparency). Server components.
 *
 * One visual language: large tight headlines, lucide icons in hairline tiles
 * as the only ornament, hairline grids, the product itself as the picture,
 * and one light closing card. No pills, no coloured dots, no gradients
 * behind text. Groups fade up on scroll through Reveal, which never hides
 * content before hydration or for reduced-motion users.
 */

const H1 = 'font-display text-[2.6rem] font-[700] leading-[1.02] tracking-[-0.04em] text-balance sm:text-6xl lg:text-[4.25rem]';
const H2 = 'font-display text-3xl font-[700] leading-[1.08] tracking-[-0.03em] text-balance sm:text-[2.6rem]';
const LEDE = 'text-lg leading-relaxed text-ink/60 sm:text-xl';

type Cta = { href: string; label: string };

export function IconTile({ icon: Icon, size = 'md' }: { icon: LucideIcon; size?: 'md' | 'lg' }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl border border-line bg-paper text-ink shadow-[0_1px_2px_rgba(28,26,20,0.05)] ${
        size === 'lg' ? 'h-12 w-12' : 'h-10 w-10'
      }`}
    >
      <Icon className={size === 'lg' ? 'h-[22px] w-[22px]' : 'h-5 w-5'} strokeWidth={1.6} aria-hidden="true" />
    </span>
  );
}

/** Small line above a heading: an icon and a word, nothing more. */
export function Kicker({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-ink/55">
      {Icon ? <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" /> : null}
      {children}
    </p>
  );
}

function CtaRow({ primary, secondary }: { primary: Cta; secondary?: Cta }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
      <Link href={primary.href} className="btn btn-primary btn-lg justify-center gap-2">
        {primary.label}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      {secondary ? (
        <Link
          href={secondary.href}
          className="group inline-flex items-center justify-center gap-1.5 py-2 text-[15px] font-medium text-ink/75 transition hover:text-ink"
        >
          {secondary.label}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

export function Hero({
  icon,
  kicker,
  title,
  lede,
  meta,
  primary = { href: '/login', label: 'Start scheduling free' },
  secondary,
  visual,
}: {
  icon: LucideIcon;
  kicker: string;
  title: string;
  lede: string;
  /** Faint line under the CTAs, e.g. the CMS "Updated …" date. */
  meta?: string;
  primary?: Cta;
  secondary?: Cta;
  /** The product, framed on a soft stage under the copy. */
  visual?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-[1200px] px-4 pt-16 sm:px-6 sm:pt-24 md:pt-28">
        <Reveal y={18} stagger={0.07}>
          <Kicker icon={icon}>{kicker}</Kicker>
          <h1 className={`mt-5 max-w-4xl ${H1}`}>{title}</h1>
          <p className={`mt-6 max-w-2xl ${LEDE}`}>{lede}</p>
          <div className="mt-9">
            <CtaRow primary={primary} secondary={secondary} />
          </div>
          {meta ? <p className="mt-5 text-xs text-ink/45">{meta}</p> : null}
        </Reveal>
      </div>
      {visual ? (
        <div className="mx-auto mt-16 max-w-[1200px] px-4 sm:mt-20 sm:px-6">
          <Reveal y={32}>
            <div className="rounded-[28px] border border-line bg-surface p-2 sm:p-4 md:p-6">{visual}</div>
          </Reveal>
        </div>
      ) : null}
      <div className={visual ? 'h-20 sm:h-28' : 'h-16 sm:h-24'} />
    </section>
  );
}

/** Heading block for a section: kicker, title, optional lede beside it. */
export function SectionHead({
  icon,
  kicker,
  title,
  lede,
}: {
  icon?: LucideIcon;
  kicker: string;
  title: string;
  lede?: string;
}) {
  return (
    <Reveal className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-16">
      <div>
        <Kicker icon={icon}>{kicker}</Kicker>
        <h2 className={`mt-4 max-w-2xl ${H2}`}>{title}</h2>
      </div>
      {lede ? <p className="max-w-md text-base leading-relaxed text-ink/60 sm:text-[17px]">{lede}</p> : <div />}
    </Reveal>
  );
}

export function Section({
  children,
  tone = 'paper',
  flush = false,
}: {
  children: ReactNode;
  tone?: 'paper' | 'surface';
  /** Continues straight on from the hero: no rule, no top padding. */
  flush?: boolean;
}) {
  return (
    <section className={`${flush ? '' : 'border-t border-line'} ${tone === 'surface' ? 'bg-surface/60' : ''}`}>
      <div className={`mx-auto max-w-[1200px] px-4 sm:px-6 ${flush ? 'pb-20 md:pb-28' : 'py-20 md:py-28'}`}>{children}</div>
    </section>
  );
}

export interface IconItem {
  icon: LucideIcon;
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
}

/** Hairline grid of icon cards. */
export function IconGrid({ items, cols = 3 }: { items: IconItem[]; cols?: 2 | 3 | 4 }) {
  const grid = cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <Reveal
      className={`mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-[24px] border border-line bg-line ${grid}`}
      stagger={0.05}
    >
      {items.map((it) => {
        const inner = (
          <>
            <IconTile icon={it.icon} />
            <h3 className="mt-6 font-display text-lg font-[700] tracking-[-0.015em]">{it.title}</h3>
            <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink/60">{it.body}</p>
            {it.href ? (
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                {it.linkLabel ?? 'Learn more'}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            ) : null}
          </>
        );
        const cls = 'group flex flex-col bg-paper p-7 sm:p-8';
        return it.href ? (
          <Link key={it.title} href={it.href} className={`${cls} transition-colors hover:bg-surface/70`}>
            {inner}
          </Link>
        ) : (
          <div key={it.title} className={cls}>
            {inner}
          </div>
        );
      })}
    </Reveal>
  );
}

/** Checklist with icon marks; used beside product visuals and in cards. */
export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3.5">
      {items.map((p) => (
        <li key={p} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink/75">
          <span className="mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line bg-paper">
            <Check className="h-3 w-3 text-ink" strokeWidth={2.5} aria-hidden="true" />
          </span>
          {p}
        </li>
      ))}
    </ul>
  );
}

/** Copy on one side, the product on the other; `flip` swaps sides. */
export function Split({
  icon,
  kicker,
  title,
  body,
  points,
  visual,
  flip = false,
}: {
  icon: LucideIcon;
  kicker: string;
  title: string;
  body: string;
  points?: string[];
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
      <Reveal className={`lg:col-span-5 ${flip ? 'lg:order-2' : ''}`}>
        <Kicker icon={icon}>{kicker}</Kicker>
        <h2 className={`mt-4 ${H2}`}>{title}</h2>
        <p className="mt-5 text-base leading-relaxed text-ink/60 sm:text-[17px]">{body}</p>
        {points ? (
          <div className="mt-8">
            <CheckList items={points} />
          </div>
        ) : null}
      </Reveal>
      <Reveal y={32} className={`min-w-0 lg:col-span-7 ${flip ? 'lg:order-1' : ''}`}>
        <div className="rounded-[24px] border border-line bg-surface p-2 sm:p-4">{visual}</div>
      </Reveal>
    </div>
  );
}

/** Row of big figures with a line each. */
export function Stats({ items }: { items: { value: string; label: string }[] }) {
  return (
    <Reveal
      className="grid grid-cols-2 gap-px overflow-hidden rounded-[24px] border border-line bg-line lg:grid-cols-4"
      stagger={0.05}
    >
      {items.map((s) => (
        <div key={s.label} className="bg-paper p-6 sm:p-8">
          <p className="font-display text-4xl font-[700] tracking-[-0.04em] sm:text-5xl">{s.value}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink/60">{s.label}</p>
        </div>
      ))}
    </Reveal>
  );
}

/** Numbered steps with an icon each, joined by a hairline on wide screens. */
export function Steps({ items }: { items: IconItem[] }) {
  return (
    <Reveal className="relative mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8" stagger={0.08}>
      {items.map((s, i) => (
        <div key={s.title} className="relative">
          <div className="flex items-center gap-4">
            <IconTile icon={s.icon} />
            <span className="font-display text-sm font-[700] tabular-nums text-ink/35">{String(i + 1).padStart(2, '0')}</span>
            {i < items.length - 1 ? <span className="hidden h-px flex-1 bg-line lg:block" aria-hidden="true" /> : null}
          </div>
          <h3 className="mt-6 font-display text-lg font-[700] tracking-[-0.015em]">{s.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/60">{s.body}</p>
        </div>
      ))}
    </Reveal>
  );
}

/** The closing card every page ends on; light, so it never merges with the black footer below. */
export function CtaCard({
  title,
  body,
  primary = { href: '/login', label: 'Start scheduling free' },
  secondary = { href: '/pricing', label: 'See pricing' },
}: {
  title: string;
  body: string;
  primary?: Cta;
  secondary?: Cta;
}) {
  return (
    <section className="px-3 pb-6 pt-4 sm:px-4">
      <Reveal className="mx-auto max-w-[1440px]">
        <div className="relative overflow-hidden rounded-[32px] border border-line bg-surface px-6 py-16 sm:px-12 sm:py-20 md:py-24">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="max-w-3xl font-display text-[2.25rem] font-[700] leading-[1.05] tracking-[-0.035em] text-balance sm:text-5xl md:text-[3.5rem]">
              {title}
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink/60">{body}</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <Link href={primary.href} className="btn btn-primary btn-lg justify-center gap-2">
                {primary.label}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href={secondary.href}
                className="group inline-flex items-center justify-center gap-1.5 py-2 text-[15px] font-medium text-ink/75 transition hover:text-ink"
              >
                {secondary.label}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
