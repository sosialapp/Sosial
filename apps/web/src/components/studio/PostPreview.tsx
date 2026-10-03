import ChannelAvatar from '@/components/ChannelAvatar';
import { ChromeIcon } from '@/components/studio/blocks';
import { providerMeta } from '@/lib/providers';

/**
 * Pure single-card post preview in each network's own post style — no
 * canvas background, no bottom avatar row, no watermark. Only the five
 * networks with a faithful sealed style get one; everything else renders
 * an honest "no preview" note instead of a fake mock.
 */

export const PREVIEWABLE = ['facebook', 'instagram', 'threads', 'x', 'bluesky'];

function Head({
  name,
  handle,
  network,
  time,
  avatarUrl,
  provider,
  sub,
}: {
  name: string;
  handle: string;
  network: string;
  time?: string;
  avatarUrl?: string;
  provider: string;
  sub?: string;
}) {
  const displayName = name.replace(/^@/, '') || network;
  return (
    <div className="flex items-center gap-2.5">
      <ChannelAvatar provider={provider} avatar={avatarUrl} size={34} badge={false} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-bold text-[#111111]">
          {displayName}{' '}
          {sub ? <span className="font-medium text-[#65676B]">{sub}</span> : null}
        </p>
        <p className="truncate text-[11px] text-[#65676B]">{handle} · {network}{time ? ` · ${time}` : ''}</p>
      </div>
    </div>
  );
}

function Body({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-[#111111] [overflow-wrap:anywhere]">
      {text.slice(0, 400)}
      {text.length > 400 ? '…' : ''}
    </p>
  );
}

function Media({ imageUrl, videoUrl }: { imageUrl?: string; videoUrl?: string }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className="max-h-64 w-full rounded-xl object-cover" />;
  }
  if (videoUrl) {
    return <video src={videoUrl} muted playsInline className="max-h-64 w-full rounded-xl object-cover" />;
  }
  return null;
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
  name,
  handle,
  avatarUrl,
  body,
  imageUrl,
  videoUrl,
}: {
  provider: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  body: string;
  imageUrl?: string;
  videoUrl?: string;
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
      <article className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="flex items-center gap-2.5 px-3 pt-3">
          <ChannelAvatar provider={provider} avatar={avatarUrl} size={30} badge={false} />
          <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#111111]">{name}</p>
          <span className="text-base leading-none font-bold text-[#111111]">···</span>
        </div>
        <div className="mt-2 space-y-2 px-3 pb-3">
          <Body text={body} />
          <Media imageUrl={imageUrl} videoUrl={videoUrl} />
          <div className="flex items-center gap-3.5 pt-0.5 text-[#111111]">
            <ChromeIcon name="ig-heart" size={22} color="#111111" />
            <ChromeIcon name="ig-comment" size={21} color="#111111" />
            <ChromeIcon name="ig-plane" size={21} color="#111111" />
            <span className="flex-1" />
            <ChromeIcon name="ig-bookmark" size={21} color="#111111" />
          </div>
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
        <Head name={name} handle={handle} network={meta.label} time="now" avatarUrl={avatarUrl} provider={provider} />
        <Body text={body} />
        <Media imageUrl={imageUrl} videoUrl={videoUrl} />
        <Actions items={icons.map((icon) => ({ icon, size: 16 }))} />
      </article>
    );
  }

  if (provider === 'threads') {
    return (
      <article className="space-y-2 rounded-2xl border border-line bg-white p-3.5">
        <Head name={name} handle={handle} network={meta.label} time="now" avatarUrl={avatarUrl} provider={provider} />
        <Body text={body} />
        <Media imageUrl={imageUrl} videoUrl={videoUrl} />
        <Actions items={[{ icon: 'ig-heart' }, { icon: 'ig-comment' }, { icon: 'th-repost' }, { icon: 'th-send' }]} />
      </article>
    );
  }

  // facebook
  return (
    <article className="space-y-2 rounded-2xl border border-line bg-white p-3.5">
      <Head
        name={name}
        handle={handle}
        network={meta.label}
        time="Just now"
        avatarUrl={avatarUrl}
        provider={provider}
        sub="· 🌐"
      />
      <Body text={body} />
      <Media imageUrl={imageUrl} videoUrl={videoUrl} />
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
