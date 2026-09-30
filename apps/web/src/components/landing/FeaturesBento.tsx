/**
 * Feature bento (Tenner architecture): the five-card grid in code — first
 * row generate / schedule / templates, second row AI automate / connect.
 * Plus Jakarta Sans throughout. Each card has a marked illustration slot
 * where supplied artwork will be placed.
 */
import type { CSSProperties } from 'react';
import Image from 'next/image';
import { BrandIcon, brandColor, type BrandProvider } from '@/components/BrandIcon';
import AiPromptBox from '@/components/landing/AiPromptBox';

const title = 'font-display text-xl font-bold leading-[22px] tracking-[-0.4px]';
const sub = 'mt-2 font-display text-sm leading-5 tracking-[-0.4px]';

/** Invisible spacer reserving the illustration area in a card. */
function ArtSlot({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={className} />;
}

function Sparkle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="#F39D01">
      <path d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10Z" />
    </svg>
  );
}

/** Official OpenAI knot outline, inherits parent text colour. */
function KnotMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.1 13.3L8 16.8l-4.2-2.6A4 4 0 0 1 6 6.7m6 7.8L6 11V6a4 4 0 0 1 7.6-2m-3.7 9.3V6.2l4.4-2.6a4 4 0 0 1 5.3 5.8m-9.7 1.3L16 7.2l4.2 2.6a4 4 0 0 1-2.2 7.5m-6-7.8l6 3.5v5a4 4 0 0 1-7.6 2m3.7-9.3v7.1l-4.4 2.6a4 4 0 0 1-5.3-5.8" />
    </svg>
  );
}

function OrbitLogo({
  provider,
  position,
  duration,
  reverse = false,
}: {
  provider: BrandProvider;
  position: string;
  duration: string;
  reverse?: boolean;
}) {
  return (
    <span aria-hidden="true" className={`absolute ${position}`}>
      <span
        style={{ '--d': duration } as CSSProperties}
        className={`block text-white ${reverse ? 'animate-orbit' : 'animate-orbit-rev'}`}
      >
        <BrandIcon provider={provider} mono className="block h-6 w-6" />
      </span>
    </span>
  );
}

function BoltEmblem() {
  const outer = '48s';
  const middle = '36s';
  return (
    <div className="relative mx-auto mt-8 h-72 w-72" aria-hidden="true">
      <div className="absolute inset-0 rounded-[28%] border border-[#FFC240] opacity-10" />
      <div className="absolute inset-[6.94%] rounded-[28%] border border-[#FFC240] opacity-30" />
      <div className="absolute inset-[13.89%] rounded-[28%] border border-[#FFC240] opacity-60" />
      <div className="absolute inset-[20.83%] rounded-[28%] border border-[#FFC240]" />
      <div
        style={{ '--d': outer } as CSSProperties}
        className="absolute inset-0 animate-orbit"
      >
        <OrbitLogo provider="facebook" position="top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" duration={outer} />
        <OrbitLogo provider="x" position="top-1/2 right-0 -translate-y-1/2 translate-x-1/2" duration={outer} />
        <OrbitLogo provider="youtube" position="bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" duration={outer} />
        <OrbitLogo provider="tiktok" position="top-1/2 left-0 -translate-x-1/2 -translate-y-1/2" duration={outer} />
      </div>
      <div
        style={{ '--d': middle } as CSSProperties}
        className="absolute inset-[13.89%] animate-orbit-rev"
      >
        <OrbitLogo provider="bluesky" position="top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" duration={middle} reverse />
        <OrbitLogo provider="threads" position="top-1/2 right-0 -translate-y-1/2 translate-x-1/2" duration={middle} reverse />
        <OrbitLogo provider="linkedin" position="bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" duration={middle} reverse />
        <OrbitLogo provider="instagram" position="top-1/2 left-0 -translate-x-1/2 -translate-y-1/2" duration={middle} reverse />
        <OrbitLogo provider="pinterest" position="top-[10%] left-[10%] -translate-x-1/2 -translate-y-1/2" duration={middle} reverse />
        <OrbitLogo provider="mastodon" position="top-[10%] right-[10%] -translate-y-1/2 translate-x-1/2" duration={middle} reverse />
      </div>
      <div className="absolute inset-[27.78%] animate-heartbeat overflow-hidden rounded-[32px] border border-[#FFC240] bg-black shadow-[0px_25px_20px_-1px_rgba(0,0,0,0.2),inset_0px_-1px_1px_1px_rgba(204,199,199,0.2),inset_0px_1px_1px_1px_rgba(204,199,199,0.2)]">
        <Image
          src="/bento-bolt.png"
          alt=""
          width={1254}
          height={1254}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>
      <Sparkle className="absolute top-[8%] left-[4%] h-5 w-5" />
      <Sparkle className="absolute top-[12%] right-[6%] h-5 w-5" />
      <Sparkle className="absolute bottom-[16%] left-[10%] h-5 w-5" />
      <Sparkle className="absolute right-[12%] bottom-[8%] h-5 w-5" />
    </div>
  );
}

export default function FeaturesBento() {
  return (
    <section aria-label="Features" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <div className="max-w-[34ch]">
          <p className="eyebrow">What you get</p>
          <h2 className="mt-2 font-display text-3xl leading-[1.12] font-semibold tracking-tight md:text-4xl">
            Everything a daily poster needs.
          </h2>
          <p className="mt-3 text-muted">
            Four tools in one workspace. Compose, queue, write and approve without bolting
            anything on.
          </p>
        </div>

        {/* First row */}
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="flex flex-col overflow-hidden rounded-xl bg-[conic-gradient(from_180deg_at_50%_50%,#FFA4FC_-27.68deg,#E064A2_1.73deg,#FFA4FC_332.32deg,#E064A2_361.73deg)] p-5 md:h-[483px]">
            <h3 className={`${title} text-[#0B0A0A]`}>
              Write and generate your content. Anytime, anywhere
            </h3>
            <p className={`${sub} text-[rgba(11,10,10,0.6)]`}>
              Choose from 100+ expert-made templates. Use your brand colors and custom fonts.
            </p>
            <div className="-mx-5 -mb-5 mt-4 flex min-h-40 flex-1 flex-col justify-end">
              <div className="relative aspect-[3391/2779] w-full">
                <Image
                  src="/bento-phones.png"
                  alt="Sosial AI writer, team dashboard and content card designer on three phones"
                  fill
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-contain"
                />
              </div>
            </div>
          </article>

          <article className="rounded-xl bg-[linear-gradient(180deg,#005BD2_0%,#7BCAC3_100%)] p-5 md:h-[483px]">
            <h3 className={`${title} text-white`}>Post now, or schedule your post in one Sosial</h3>
            <p className={`${sub} text-white`}>
              Share your presentation with a live link. Present with notes, a timer, and other
              aids.
            </p>
            <BoltEmblem />
          </article>

          <article className="flex flex-col rounded-xl bg-[linear-gradient(180deg,#96FFB9_0%,#C5DF93_100%)] p-5 md:h-[483px]">
            <h3 className={`${title} text-[#0B0A0A]`}>
              Choose your own content style from our card templates
            </h3>
            <p className={`${sub} text-[rgba(11,10,10,0.6)]`}>
              Create, craft and share stories together with real time collaboration.
            </p>
            {/* Illustration: collaboration avatars */}
            <ArtSlot className="min-h-40 flex-1" />
          </article>
        </div>

        {/* Second row */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
          <article className="relative flex flex-col overflow-hidden rounded-xl bg-[linear-gradient(180deg,#3D0E96_0%,#22086B_100%)] p-5 md:col-span-5 md:h-[483px]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(139,92,246,0.55),transparent_60%)]"
            />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <h3 className={`${title} text-white`}>Automate your content using AI</h3>
                <p className={`${sub} text-white/80`}>
                  Generate new idea, write you content with AI powered by ChatGPT latest model.
                </p>
              </div>
              {/* Illustration: AI knot mark */}
              <KnotMark className="h-20 w-20 shrink-0 text-white" />
            </div>
            <div className="relative flex flex-1 items-center">
              <AiPromptBox />
            </div>
          </article>

          <article className="relative flex flex-col overflow-hidden rounded-xl bg-black p-5 md:col-span-7 md:h-[483px]">
            <h3 className={`${title} relative text-white`}>
              Connect to our 10 channels. Up to 100 accounts
            </h3>
            <p className={`${sub} relative text-white/60`}>
              Connect your Facebook, Threads, Instagram, LinkedIn, Bluesky, Mastodon, YouTube,
              X, TikTok, Pinterest. Up to 100 accounts.
            </p>
            {/* Illustration: account avatars + channel logo grid, centered */}
            <div className="relative flex flex-1 flex-col items-center justify-center">
              <div className="flex justify-center" aria-hidden="true">
                <div className="flex -space-x-4">
                {[
                  { img: 'women/44', channel: 'threads' },
                  { img: 'men/32', channel: 'mastodon' },
                  { img: 'women/68', channel: 'instagram' },
                  { img: 'men/75', channel: 'x' },
                  { img: 'women/12', channel: 'facebook' },
                  { img: 'men/45', channel: 'tiktok' },
                  { img: 'women/33', channel: 'youtube' },
                  { img: 'men/22', channel: 'bluesky' },
                ].map((a, i, all) => (
                  <span
                    key={a.img}
                    className="relative block h-16 w-16 shrink-0"
                    style={{ zIndex: all.length - i }}
                  >
                    <Image
                      src={`https://randomuser.me/api/portraits/${a.img}.jpg`}
                      alt=""
                      width={128}
                      height={128}
                      loading="lazy"
                      className="block h-16 w-16 rounded-full object-cover"
                    />
                    <span
                      className="absolute flex items-center justify-center rounded-full"
                      style={{
                        right: -2,
                        bottom: -2,
                        width: 35,
                        height: 35,
                        background: brandColor(a.channel as BrandProvider),
                      }}
                    >
                      <BrandIcon
                        provider={a.channel as BrandProvider}
                        mono
                        className="h-[62%] w-[62%] text-white"
                      />
                    </span>
                  </span>
                ))}
                </div>
              </div>
              <div
                className="relative mx-auto mt-5 grid w-full max-w-md grid-cols-5 place-items-center gap-x-6 gap-y-5"
                aria-hidden="true"
              >
              {(
                [
                  'x',
                  'mastodon',
                  'pinterest',
                  'threads',
                  'instagram',
                  'facebook',
                  'youtube',
                  'bluesky',
                  'tiktok',
                  'linkedin',
                ] as BrandProvider[]
              ).map((p) => (
                <BrandIcon key={p} provider={p} badge={false} className="h-12 w-12" />
              ))}
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
