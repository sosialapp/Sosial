import { useEffect, useState } from 'react';
import ChannelAvatar from '@/components/ChannelAvatar';
import { ChromeIcon, VERIFIED_SEAL } from '@/components/studio/blocks';
import { providerMeta } from '@/lib/providers';

/**
 * Pure single-card post preview in each network's own post style — no
 * canvas background, no bottom avatar row, no watermark. Only the five
 * networks with a faithful sealed style get one; everything else renders
 * an honest "no preview" note instead of a fake mock.
 */

export const PREVIEWABLE = ['facebook', 'instagram', 'threads', 'x', 'bluesky'];

function Head({ handle, avatarUrl, provider, verified, dotsV }: { handle: string; avatarUrl?: string; provider: string; verified?: boolean; dotsV?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <ChannelAvatar provider={provider} avatar={avatarUrl} size={32} badge={false} />
      <p className="flex min-w-0 flex-1 items-center gap-[2px] truncate text-[13px] font-bold text-[#111111]">
        <span className="truncate">{handle}</span>
        {verified ? (
          <svg width="15" height="15" viewBox="0 0 24 24" aria-label="Verified" className="shrink-0">
            <path d={VERIFIED_SEAL} fill="#1D9BF0" />
            <path d="m8.5 12.2 2.4 2.4 4.6-5" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </p>
      {dotsV ? <ChromeIcon name="dots-v" size={15} color="#111111" /> : null}
    </div>
  );
}

function Body({ text, hashtagColor }: { text: string; hashtagColor?: string }) {
  if (!text) return null;
  const body = text.slice(0, 400) + (text.length > 400 ? '…' : '');
  if (!hashtagColor) {
    return (
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-[#111111] [overflow-wrap:anywhere]">
        {body}
      </p>
    );
  }
  // Hashtags ride blue, exactly like the network renders them.
  const parts = body.split(/(#[A-Za-z0-9_]+)/g);
  return (
    <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-[#111111] [overflow-wrap:anywhere]">
      {parts.map((part, i) =>
        /^#[A-Za-z0-9_]+$/.test(part) ? (
          <span key={i} style={{ color: hashtagColor }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

function Media({ imageUrl, videoUrl, provider }: { imageUrl?: string; videoUrl?: string; provider: string }) {
  const url = imageUrl ?? videoUrl;
  const kind = imageUrl ? 'image' : 'video';
  const natural = useNaturalSize(url, kind);
  if (!url) return null;
  const ratio = frameRatio(provider, kind, natural);
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={imageUrl}
        alt=""
        className="w-full rounded-xl object-cover"
        style={{ aspectRatio: ratio }}
      />
    );
  }
  return (
    <video
      src={videoUrl}
      muted
      playsInline
      className="w-full rounded-xl object-cover"
      style={{ aspectRatio: ratio }}
    />
  );
}

/**
 * Natural dimensions of the attached file (measured in-browser, never
 * uploaded). Null while loading — callers fall back to a provider default.
 */
function useNaturalSize(url: string | undefined, kind: 'image' | 'video'): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!url) {
      setSize(null);
      return;
    }
    let live = true;
    setSize(null);
    if (kind === 'image') {
      const img = new Image();
      img.onload = () => {
        if (live && img.naturalWidth > 0 && img.naturalHeight > 0) {
          setSize({ w: img.naturalWidth, h: img.naturalHeight });
        }
      };
      img.src = url;
    } else {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        if (live && v.videoWidth > 0 && v.videoHeight > 0) {
          setSize({ w: v.videoWidth, h: v.videoHeight });
        }
      };
      v.src = url;
    }
    return () => {
      live = false;
    };
  }, [url, kind]);
  return size;
}

/**
 * Provider-true frame: the attachment's real ratio clamped into what the
 * network actually renders (w/h). Approximations of public layout behavior:
 * Instagram feed crops to 4:5–1.91:1 (Reels 9:16), X to a wide timeline
 * crop, Threads/Facebook/Bluesky stay close to native within sane extremes.
 * object-cover then crops exactly like the network does.
 */
function frameRatio(
  provider: string,
  kind: 'image' | 'video',
  natural: { w: number; h: number } | null,
): string {
  const raw = natural && natural.h > 0 ? natural.w / natural.h : null;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  if (provider === 'instagram') {
    if (kind === 'video') return `${(raw === null ? 9 / 16 : clamp(raw, 9 / 16, 1.91)).toFixed(4)} / 1`;
    return `${(raw === null ? 1 : clamp(raw, 0.8, 1.91)).toFixed(4)} / 1`;
  }
  if (provider === 'x') {
    return `${(raw === null ? 16 / 9 : clamp(raw, 0.75, 2)).toFixed(4)} / 1`;
  }
  if (provider === 'threads') {
    return `${(raw === null ? 1 : clamp(raw, 9 / 16, 1.91)).toFixed(4)} / 1`;
  }
  if (provider === 'facebook') {
    return `${(raw === null ? 1 : clamp(raw, 0.5, 1.91)).toFixed(4)} / 1`;
  }
  // bluesky
  return `${(raw === null ? 1 : clamp(raw, 0.5, 2)).toFixed(4)} / 1`;
}

function Actions({ items }: { items: { icon: string; size?: number }[] }) {
  return (
    <div className="flex items-center justify-between px-1 pt-1 text-[#65676B]">
      {items.map((a) => (
        <ChromeIcon key={a.icon} name={a.icon} size={a.size ?? 17} color="#65676B" />
      ))}
    </div>
  );
}

export default function PostPreview({
  provider,
  handle,
  avatarUrl,
  body,
  imageUrl,
  videoUrl,
  verified,
}: {
  provider: string;
  handle: string;
  avatarUrl?: string;
  body: string;
  imageUrl?: string;
  videoUrl?: string;
  /**
   * Verified badge glued right after the handle (short names pull it left
   * with them — never a fixed offset). True when the channel metadata says
   * verified; X also defaults on because the preview mocks the connected
   * account itself — tighten per-account once connect flows record status.
   */
  verified?: boolean;
}) {
  const meta = providerMeta(provider);
  if (!PREVIEWABLE.includes(provider)) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center">
        <p className="text-[13px] font-bold">{meta.label}</p>
        <p className="mt-1 text-xs text-muted">No preview for this channel — it will still post normally.</p>
      </div>
    );
  }

  if (provider === 'instagram') {
    return (
      <article className="space-y-2 overflow-hidden rounded-2xl border border-line bg-white p-3">
        <div className="flex items-center gap-2.5">
          <ChannelAvatar provider={provider} avatar={avatarUrl} size={30} badge={false} />
          <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#111111]">{handle}</p>
          <span className="text-base leading-none font-bold text-[#111111]">···</span>
        </div>
          <Body text={body} />
          <Media imageUrl={imageUrl} videoUrl={videoUrl} provider={provider} />
          <div className="flex items-center gap-3.5 pt-0.5 text-[#111111]">
            <ChromeIcon name="ig-heart" size={22} color="#111111" />
            <ChromeIcon name="ig-comment" size={21} color="#111111" />
            <ChromeIcon name="ig-plane" size={21} color="#111111" />
            <span className="flex-1" />
            <ChromeIcon name="ig-bookmark" size={21} color="#111111" />
          </div>
      </article>
    );
  }

  if (provider === 'x' || provider === 'bluesky') {
    const icons =
      provider === 'x'
        ? ['x-comment', 'x-retweet', 'ig-heart', 'x-views']
        : ['bsky-comment', 'bsky-repost', 'bsky-heart', 'bsky-share'];
    return (
      <article className="space-y-2 rounded-2xl border border-line bg-white p-3.5">
        <Head handle={handle} avatarUrl={avatarUrl} provider={provider} verified={verified ?? provider === 'x'} dotsV={provider === 'x'} />
        <Body text={body} hashtagColor={provider === 'x' ? '#1D9BF0' : undefined} />
        <Media imageUrl={imageUrl} videoUrl={videoUrl} provider={provider} />
        <Actions items={icons.map((icon) => ({ icon, size: 16 }))} />
      </article>
    );
  }

  if (provider === 'threads') {
    return (
      <article className="space-y-2 rounded-2xl border border-line bg-white p-3.5">
        <Head handle={handle} avatarUrl={avatarUrl} provider={provider} />
        <Body text={body} />
        <Media imageUrl={imageUrl} videoUrl={videoUrl} provider={provider} />
        <Actions items={[{ icon: 'ig-heart' }, { icon: 'ig-comment' }, { icon: 'th-repost' }, { icon: 'th-send' }]} />
      </article>
    );
  }

  // facebook
  return (
    <article className="space-y-2 rounded-2xl border border-line bg-white p-3.5">
      <Head handle={handle} avatarUrl={avatarUrl} provider={provider} verified={verified} />
      <Body text={body} hashtagColor="#0866FF" />
      <Media imageUrl={imageUrl} videoUrl={videoUrl} provider={provider} />
      <div className="flex items-center justify-around border-t border-line/70 px-1 pt-2 text-[#65676B]">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <ChromeIcon name="fb-like" size={16} color="#65676B" /> Like
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <ChromeIcon name="fb-comment" size={16} color="#65676B" /> Comment
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <ChromeIcon name="fb-share" size={16} color="#65676B" /> Share
        </span>
      </div>
    </article>
  );
}
