import { ImageResponse } from 'next/og';
import type { BrandProvider } from '@/components/BrandIcon';
import { ACCENT, INK, MUTED, OG_SIZE, OgBrand, OgChannels, ogFonts, ogPublic } from '@/lib/ogKit';

export const runtime = 'edge';
export const alt = 'Sosial: plan, write and publish everywhere you post';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** The channels shown as logo discs; the rest count up in the "+N" disc. */
const SHOWN: BrandProvider[] = ['instagram', 'tiktok', 'x', 'facebook', 'threads', 'youtube', 'linkedin', 'bluesky', 'pinterest'];
const TOTAL_CHANNELS = 18;

/** Default social card: the brand on white, the app on a yellow panel, channel logos underneath. */
export default async function OgImage() {
  const headline = 'Plan, write and publish everywhere you post.';
  const sub = 'One composer, calendar and queue, with an AI writer and approvals built in.';
  const [fonts, bolt, devices] = await Promise.all([
    ogFonts(`Sosial${headline}+${TOTAL_CHANNELS - SHOWN.length}sosial.app`, `${sub}Works withsosial.app`),
    ogPublic('bolt.png'),
    ogPublic('hero-devices.png'),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#FFFFFF',
          color: INK,
          fontFamily: fonts.length ? 'Jakarta' : 'sans-serif',
        }}
      >
        {/* Right: the app on devices, on a yellow panel that bleeds off the edge. */}
        <div
          style={{
            position: 'absolute',
            top: 44,
            right: -40,
            bottom: 44,
            width: 560,
            borderRadius: 48,
            background: ACCENT,
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          {devices ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={devices as unknown as string} width={700} height={436} style={{ marginLeft: 36 }} />
          ) : null}
        </div>

        {/* Left: brand, promise, channels. */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 640, padding: '64px 0 56px 72px' }}>
          <OgBrand bolt={bolt} />
          <div style={{ marginTop: 44, fontSize: 60, fontWeight: 800, lineHeight: 1.06, letterSpacing: -2.2, display: 'flex' }}>
            {headline}
          </div>
          <div style={{ marginTop: 22, fontSize: 25, fontWeight: 500, lineHeight: 1.4, color: MUTED, maxWidth: 520, display: 'flex' }}>
            {sub}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: MUTED, letterSpacing: 2.4, textTransform: 'uppercase', display: 'flex' }}>
              Works with
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <OgChannels shown={SHOWN} total={TOTAL_CHANNELS} />
              <div style={{ marginLeft: 20, fontSize: 20, fontWeight: 800, color: MUTED, display: 'flex' }}>sosial.app</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
