'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { BrandIcon, type BrandProvider } from '@/components/BrandIcon';
import { SourceMark, AiMark } from '@/components/SourceMarks';

/**
 * Logo dock (GreenSock macOS-dock pen, calmed down): channel + integration
 * icons magnify gently as the cursor travels each strip — wide falloff,
 * small boost, slow ease, so hovering never feels twitchy. Static rows
 * under reduced motion and touch. Two labeled panels side by side on
 * desktop (Integrate | Channels), stacked on mobile.
 */

const CHANNELS: BrandProvider[] = [
  'instagram',
  'tiktok',
  'x',
  'facebook',
  'threads',
  'youtube',
  'linkedin',
  'bluesky',
  'mastodon',
  'pinterest',
  'telegram',
  'discord',
  'wordpress',
  'devto',
  'hashnode',
  'ghost',
  'vk',
  'gmb',
];

const INTEGRATIONS = ['canva', 'unsplash', 'drive', 'gphotos', 'dropbox', 'onedrive', 'notion', 'zapier', 'sheets'] as const;

/** AI agents that can operate Sosial through MCP (Team → AI & Developer). */
const AGENTS = [
  { id: 'claude', label: 'Claude' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'copilot', label: 'Copilot' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'muse', label: 'Muse' },
  { id: 'dots', label: 'Dots' },
  { id: 'codex', label: 'Codex' },
  { id: 'hermes', label: 'Hermes' },
  { id: 'openclaw', label: 'OpenClaw' },
] as const;

const RANGE = 180;
const BOOST = 0.35;

function magnify(track: HTMLDivElement | null): () => void {
  if (!track) return () => {};
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const icons = Array.from(track.children) as HTMLElement[];
  gsap.set(icons, { transformOrigin: '50% 100%' });
  const onMove = (e: MouseEvent) => {
    const mx = e.clientX;
    icons.forEach((el) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(mx - (r.left + r.width / 2));
      const t = Math.max(0, 1 - d / RANGE);
      const eased = t * t;
      gsap.to(el, {
        scale: 1 + BOOST * eased,
        y: -10 * eased,
        duration: 0.5,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    });
  };
  const onLeave = () => {
    gsap.to(icons, { scale: 1, y: 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
  };
  track.addEventListener('mousemove', onMove);
  track.addEventListener('mouseleave', onLeave);
  return () => {
    track.removeEventListener('mousemove', onMove);
    track.removeEventListener('mouseleave', onLeave);
  };
}

export default function LogoDock() {
  const channelsRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanups = [magnify(channelsRef.current), magnify(toolsRef.current), magnify(aiRef.current)];
    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <section aria-label="Channels, integrations and AI agents" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:pt-12 md:pt-16">
        <div className="flex justify-center">
          <div className="flex w-full flex-col items-stretch gap-5 rounded-[28px] border border-line bg-white/70 px-4 py-5 backdrop-blur-sm sm:px-8 md:flex-row md:items-center">
            {/* Integrate — tools that feed the composer, plus the AI agents
                that can operate Sosial through MCP, in one panel. */}
            <div className="flex flex-col md:max-w-[360px]">
              <p className="mb-3 text-center text-[11px] font-extrabold tracking-[0.18em] text-faint uppercase">
                Integrate
              </p>
              <div
                ref={toolsRef}
                className="flex flex-wrap items-end justify-center gap-3 overflow-visible px-1 sm:gap-4"
              >
                {INTEGRATIONS.map((t) => (
                  <span key={t} className="block shrink-0 will-change-transform" title={t}>
                    <SourceMark id={t} className="block h-9 w-9 sm:h-12 sm:w-12 [&_svg]:h-full [&_svg]:w-full" />
                  </span>
                ))}
              </div>
              <p className="mt-4 mb-3 text-center text-[10px] font-extrabold tracking-[0.18em] text-faint uppercase">
                AI agents · via MCP
              </p>
              <div
                ref={aiRef}
                className="flex flex-wrap items-end justify-center gap-3 overflow-visible px-1 sm:gap-4"
              >
                {AGENTS.map((a) => (
                  <span key={a.id} className="block shrink-0 will-change-transform" title={`${a.label} — via MCP`}>
                    <AiMark id={a.id} className="block h-9 w-9 sm:h-12 sm:w-12 [&_svg]:h-full [&_svg]:w-full" />
                  </span>
                ))}
              </div>
            </div>

            {/* Divider: vertical on desktop, horizontal on mobile */}
            <div className="mx-auto h-px w-24 shrink-0 bg-line md:mx-0 md:h-24 md:w-px md:self-center" aria-hidden="true" />

            {/* Channels — where posts land. One swipeable row on mobile
                (no-wrap + scroll, edge-fade mask) so 19 logos never stack
                into a tall wrapped block; two centered wrapped rows on sm+. */}
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="mb-3 text-center text-[11px] font-extrabold tracking-[0.18em] text-faint uppercase">
                Channels
              </p>
              <div className="relative">
                <div
                  ref={channelsRef}
                  className="no-scrollbar -mx-4 flex items-end justify-start gap-3 overflow-x-auto px-4 pt-4 pb-1 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] md:mx-0 md:max-w-[688px] md:flex-wrap md:justify-center md:overflow-visible md:px-1 md:pt-1 md:[mask-image:none]"
                >
                  {CHANNELS.map((c) => (
                    <span key={c} className="block shrink-0 will-change-transform">
                      <BrandIcon provider={c} className="h-9 w-9 sm:h-12 sm:w-12" />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
