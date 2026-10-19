'use client';

/**
 * Channel scope picker, the composer's channel pills reused for team
 * permissions: an "All accounts" pill plus one pill per connected account.
 * Selection is provider-level (the P1 grants model), so picking either of two
 * Instagram accounts grants the Instagram provider.
 */
import ChannelAvatar from '@/components/ChannelAvatar';
import { channelAvatar } from '@/lib/channelAvatar';
import { providerMeta } from '@/lib/providers';

export interface ChannelScopeRow {
  provider: string;
  external_id: string;
  display_name: string | null;
  handle: string | null;
  metadata: Record<string, unknown> | null;
}

export default function ChannelScopePills({
  channels,
  all,
  selected,
  onChange,
  size = 30,
}: {
  channels: ChannelScopeRow[];
  /** True when the member may post to every account. */
  all: boolean;
  /** Providers granted when `all` is false. */
  selected: string[];
  onChange: (all: boolean, selected: string[]) => void;
  size?: number;
}) {
  const toggle = (provider: string) => {
    const next = selected.includes(provider)
      ? selected.filter((p) => p !== provider)
      : [...selected, provider];
    onChange(false, next);
  };

  const pill = (on: boolean): string =>
    `flex items-center gap-2 rounded-full border py-1 text-xs font-bold transition ${
      on
        ? 'border-ink bg-paper text-ink'
        : 'border-line bg-paper text-faint opacity-60 hover:opacity-100'
    }`;

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Accounts">
      <button
        type="button"
        aria-pressed={all}
        onClick={() => onChange(true, [])}
        className={`${pill(all)} px-3`}
      >
        All accounts
      </button>
      {channels.map((c) => {
        const on = !all && selected.includes(c.provider);
        const label = providerMeta(c.provider).label;
        const rawHandle =
          typeof c.handle === 'string' && c.handle.trim()
            ? c.handle.trim().replace(/^@/, '')
            : null;
        const sub = rawHandle ?? (c.display_name && c.display_name !== label ? c.display_name : null);
        return (
          <button
            key={`${c.provider}:${c.external_id}`}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(c.provider)}
            title={c.display_name ?? label}
            className={`${pill(on)} pl-1 pr-2.5`}
          >
            <ChannelAvatar provider={c.provider} avatar={channelAvatar(c.metadata)} size={size} />
            <span className="min-w-0 text-left leading-tight">
              <span className="block">{label}</span>
              {sub ? (
                <span className="block truncate text-[10px] font-semibold text-muted">
                  {rawHandle ? `@${rawHandle}` : sub}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
