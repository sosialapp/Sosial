import Image from 'next/image';

/**
 * Feature bento (Tenner architecture): section header plus the bento
 * artwork — write/generate, schedule, templates, AI automation and the
 * ten-channel connector in one graphic.
 */
export default function FeaturesBento() {
  return (
    <section aria-label="Features" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 pt-20 md:pt-28">
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
      </div>

      <div className="mt-10 pb-20 md:pb-28">
        <Image
          src="/bento-grids.png"
          alt="Sosial features: write and generate content, post now or schedule, card templates with collaboration, AI automation, and connections to ten channels"
          width={2880}
          height={1988}
          loading="lazy"
          sizes="100vw"
          className="h-auto w-full"
        />
      </div>
    </section>
  );
}
