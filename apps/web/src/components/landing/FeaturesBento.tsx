import Image from 'next/image';

/**
 * Feature bento (Tenner architecture): section header plus the bento
 * artwork — write/generate, schedule, templates, AI automation and the
 * ten-channel connector in one graphic.
 */
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

        <div className="mt-10 overflow-hidden rounded-[28px]">
          <Image
            src="/bento-grids.svg"
            alt="Sosial features: write and generate content, post now or schedule, card templates with collaboration, AI automation, and connections to ten channels"
            width={1440}
            height={994}
            loading="lazy"
            sizes="(max-width: 1152px) 100vw, 1152px"
            className="h-auto w-full"
          />
        </div>
      </div>
    </section>
  );
}
