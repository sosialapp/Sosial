/**
 * Feature bento (Tenner architecture): section header plus the coded first
 * row — generate (pink conic), schedule (blue gradient with the bolt
 * emblem), templates (green gradient). Plus Jakarta Sans throughout.
 */

const title = 'font-display text-2xl font-bold leading-5 tracking-[-0.4px]';
const sub = 'mt-2 font-display text-sm leading-5 tracking-[-0.4px]';

function Sparkle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="#F39D01">
      <path d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10Z" />
    </svg>
  );
}

function BoltEmblem() {
  return (
    <div className="relative mx-auto mt-8 h-64 w-64" aria-hidden="true">
      <div className="absolute inset-0 rounded-[112px] border border-[#FFC240] opacity-10" />
      <div className="absolute inset-[6.94%] rounded-[92px] border border-[#FFC240] opacity-30" />
      <div className="absolute inset-[13.89%] rounded-[72px] border border-[#FFC240] opacity-60" />
      <div className="absolute inset-[20.83%] rounded-[52px] border border-[#FFC240]" />
      <div className="absolute inset-[27.78%] flex items-center justify-center rounded-[32px] border border-[#FFC240] bg-black shadow-[0px_25px_20px_-1px_rgba(0,0,0,0.2),inset_0px_-1px_1px_1px_rgba(204,199,199,0.2),inset_0px_1px_1px_1px_rgba(204,199,199,0.2)]">
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="#FFC240" aria-hidden="true">
          <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />
        </svg>
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

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-xl bg-[conic-gradient(from_180deg_at_50%_50%,#FFA4FC_-27.68deg,#E064A2_1.73deg,#FFA4FC_332.32deg,#E064A2_361.73deg)] p-5 md:h-[483px]">
            <h3 className={`${title} text-[#0B0A0A]`}>
              Write and generate your content. Anytime, anywhere
            </h3>
            <p className={`${sub} text-[rgba(11,10,10,0.6)]`}>
              Choose from 100+ expert-made templates. Use your brand colors and custom fonts.
            </p>
          </article>

          <article className="rounded-xl bg-[linear-gradient(180deg,#005BD2_0%,#7BCAC3_100%)] p-5 md:h-[483px]">
            <h3 className={`${title} text-white`}>Post now, or schedule your post in one Sosial</h3>
            <p className={`${sub} text-white`}>
              Share your presentation with a live link. Present with notes, a timer, and other
              aids.
            </p>
            <BoltEmblem />
          </article>

          <article className="rounded-xl bg-[linear-gradient(180deg,#96FFB9_0%,#C5DF93_100%)] p-5 md:h-[483px]">
            <h3 className={`${title} text-[#0B0A0A]`}>
              Choose your own content style from our card templates
            </h3>
            <p className={`${sub} text-[rgba(11,10,10,0.6)]`}>
              Create, craft and share stories together with real time collaboration.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
