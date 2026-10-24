'use client';

/**
 * Shared pieces of the Community inbox (Comments + Messages): the two-pane
 * shell, the person face with its platform badge, the channel filter strip
 * and the relative timestamp. Both tabs render the same layout — a list on
 * the left and the open item on the right at lg+, one or the other below.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { MessageCircle } from 'lucide-react';
import SafeImg from '@/components/SafeImg';
import SegmentedPills from '@/components/ui/segmented-pills';
import ChannelAvatar from '@/components/ChannelAvatar';
import { BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import { channelAvatar } from '@/lib/channelAvatar';
import { providerMeta } from '@/lib/providers';
import type { ConnectedChannel } from '@/lib/types';

export function when(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Day label for chat separators: Today, Yesterday, or the date. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(today) - start(d)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: days < 7 ? 'long' : undefined,
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * A person on the other side: platform avatar when known, initial bubble when
 * not, with the network's logo riding in the corner so a mixed list reads at
 * a glance.
 */
export function Face({
  name,
  avatar,
  size = 40,
  platform,
}: {
  name: string | null;
  avatar: string | null | undefined;
  size?: number;
  platform?: string;
}) {
  const letter = (name ?? '').trim().replace('@', '').charAt(0).toUpperCase();
  const badge = Math.max(14, Math.round(size * 0.42));
  const initial = letter ? (
    <span className="font-display font-extrabold" style={{ fontSize: Math.round(size * 0.4) }}>
      {letter}
    </span>
  ) : (
    <MessageCircle style={{ width: size * 0.45, height: size * 0.45 }} />
  );
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-line bg-surface text-soft">
        {avatar ? (
          <SafeImg
            src={avatar}
            alt=""
            width={size}
            height={size}
            fallback={initial}
            className="h-full w-full object-cover"
          />
        ) : (
          initial
        )}
      </span>
      {platform ? (
        <span
          className="absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full ring-2 ring-card"
          style={{ width: badge, height: badge, background: providerMeta(platform).color }}
        >
          <BrandIcon
            provider={platform as BrandProvider}
            mono
            className="block text-white"
            style={{ width: badge - 6, height: badge - 6 }}
          />
        </span>
      ) : null}
    </span>
  );
}

/** Horizontal, swipeable channel filter: never wraps, so it stays one row on a phone. */
export function ChannelStrip({
  channels,
  value,
  onChange,
}: {
  channels: ConnectedChannel[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (channels.length < 2) return null;
  return (
    <SegmentedPills
      ariaLabel="Filter by channel"
      value={value}
      onChange={(id) => onChange(id === value ? 'all' : id)}
      className="w-full"
      buttonClassName="!py-1"
      options={[
        { value: 'all', label: 'All' },
        ...channels.map((c) => {
          const name = c.display_name || providerMeta(c.provider).label;
          return {
            value: c.id,
            title: `${name} · ${providerMeta(c.provider).label}`,
            label: (
              <>
                <ChannelAvatar provider={c.provider} avatar={channelAvatar(c.metadata)} size={20} badge={false} />
                <span className="max-w-32 truncate">{name}</span>
              </>
            ),
          };
        }),
      ]}
    />
  );
}

/** Small single-choice switch used for sort and status filters. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return <SegmentedPills ariaLabel={label} value={value} onChange={onChange} options={options} size="sm" />;
}

/**
 * Phone chat sizing. On iOS the keyboard shrinks only the *visual* viewport
 * (100dvh stays put), so a pane sized in dvh runs under the keyboard and the
 * page scrolls behind it. Track visualViewport instead, and lock the page
 * underneath while the full-screen pane is up.
 */
function usePhonePane(active: boolean): CSSProperties | undefined {
  const [box, setBox] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    if (!active || isWide()) {
      setBox(null);
      return;
    }
    const vv = window.visualViewport;
    const sync = () => setBox({ h: vv?.height ?? window.innerHeight, top: vv?.offsetTop ?? 0 });
    sync();
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      html.style.overflow = prev;
    };
  }, [active]);
  return box ? ({ '--pane-h': `${box.h}px`, '--pane-top': `${box.top}px` } as CSSProperties) : undefined;
}

/**
 * The inbox frame: list + detail side by side at lg+, a single pane below.
 * `detailOpen` decides which pane a phone sees; the desktop always sees both.
 * Fixed height so the list and the thread scroll on their own and the reply
 * box stays pinned to the bottom. On a phone the open item leaves the page
 * chrome behind and takes the whole screen, messenger-style, sized to the
 * visible viewport so the composer sits right on top of the keyboard.
 */
export function InboxShell({
  list,
  detail,
  detailOpen,
}: {
  list: ReactNode;
  detail: ReactNode;
  detailOpen: boolean;
}) {
  const phone = usePhonePane(detailOpen);
  return (
    <div className="grid h-[calc(100dvh-13.5rem)] min-h-[420px] overflow-hidden rounded-[var(--radius-card)] border border-line bg-card lg:h-[calc(100dvh-12.5rem)] lg:min-h-[460px] lg:grid-cols-[minmax(320px,400px)_1fr]">
      <section
        aria-label="List"
        className={`min-h-0 flex-col border-line lg:flex lg:border-r ${detailOpen ? 'hidden' : 'flex'}`}
      >
        {list}
      </section>
      <section
        aria-label="Detail"
        style={phone}
        className={`min-h-0 min-w-0 flex-col lg:flex ${
          detailOpen
            ? 'fixed inset-x-0 top-[var(--pane-top,0px)] z-50 flex h-[var(--pane-h,100dvh)] bg-card lg:static lg:z-auto lg:h-auto'
            : 'hidden'
        }`}
      >
        {detail}
      </section>
    </div>
  );
}

/** Pane header padding: clears the notch / status bar when the pane is full-screen on a phone. */
export const paneHead =
  'flex items-center gap-2 border-b border-line px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-4 lg:gap-2.5 lg:py-2.5';

/** Composer padding: clears the home indicator on a phone. */
export const paneFoot =
  'border-t border-line bg-card px-2.5 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 lg:py-3';

/** Composer text: 16px below lg, or iOS zooms the page in on focus. */
export const composerText =
  'block min-w-0 flex-1 resize-none bg-transparent py-1 text-base leading-snug text-ink outline-none placeholder:text-faint lg:text-sm lg:leading-relaxed';

/** Centered placeholder used for empty lists and the unopened detail pane. */
export function PaneEmpty({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-surface text-faint">{icon}</span>
      <p className="mt-3 font-display text-base font-extrabold">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Grow a textarea with its content, up to a comfortable cap. */
export function grow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

/** True at the desktop breakpoint, where both panes show and the first item opens by default. */
export function isWide(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
}

export const errorBox =
  'rounded-xl bg-[#FDEBEC] px-3.5 py-2.5 text-xs font-bold text-[#9F2F2D] dark:bg-[#2c1b1b] dark:text-[#f2a8a8]';
