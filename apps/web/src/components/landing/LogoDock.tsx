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

  useEffect(() => {
    const cleanups = [magnify(channelsRef.current), magnify(toolsRef.current)];
    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <section aria-label="Channels, integrations and AI agents" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:pt-12 md:pt-16">
        <div className="flex justify-center">
          <div className="flex w-full flex-col items-stretch gap-5 rounded-[28px] border border-line bg-white/70 px-4 py-5 backdrop-blur-sm sm:px-8 md:flex-row md:items-center">
            {/* Integrate — tools that feed the composer plus the AI agents
                that can operate Sosial through MCP: one tight 9×2 grid.
                Same flex footprint as Channels so the wall reads symmetric. */}
            <div className="flex min-w-0 flex-1 flex-col items-center">
              <p className="mb-3 text-center text-[11px] font-extrabold tracking-[0.18em] text-faint uppercase">
                Integrate
              </p>
              <div
                ref={toolsRef}
                className="grid w-full max-w-[340px] grid-cols-9 items-end justify-items-center gap-2 overflow-visible px-1"
              >
                {INTEGRATIONS.map((t) => (
                  <span key={t} className="block shrink-0 will-change-transform" title={t}>
                    <SourceMark id={t} className="block h-7 w-7 sm:h-8 sm:w-8 [&_svg]:h-full [&_svg]:w-full" />
                  </span>
                ))}
                {AGENTS.map((a) => (
                  <span key={a.id} className="block shrink-0 will-change-transform" title={`${a.label} — via MCP`}>
                    <AiMark id={a.id} className="block h-7 w-7 sm:h-8 sm:w-8 [&_svg]:h-full [&_svg]:w-full" />
                  </span>
                ))}
              </div>
            </div>

            {/* Divider: vertical on desktop, horizontal on mobile */}
            <div className="mx-auto h-px w-24 shrink-0 bg-line md:mx-0 md:h-24 md:w-px md:self-center" aria-hidden="true" />

            {/* Channels — where posts land: same 9×2 footprint as Integrate. */}
            <div className="flex min-w-0 flex-1 flex-col items-center">
              <p className="mb-3 text-center text-[11px] font-extrabold tracking-[0.18em] text-faint uppercase">
                Channels
              </p>
              <div
                ref={channelsRef}
                className="grid w-full max-w-[340px] grid-cols-9 items-end justify-items-center gap-2 overflow-visible px-1"
              >
                {CHANNELS.map((c) => (
                  <span key={c} className="block shrink-0 will-change-transform">
                    <BrandIcon provider={c} className="h-7 w-7 sm:h-8 sm:w-8" />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
