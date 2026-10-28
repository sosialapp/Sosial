import { ImageResponse } from 'next/og';
import { BRAND_PATHS, GLYPH_TRANSFORMS, type BrandProvider } from '@/components/BrandIcon';
import { PROVIDER_META } from '@/lib/providers';
import { ACCENT, INK, MUTED, OG_SIZE, OgBrand, ogFonts, ogPublic } from '@/lib/ogKit';

export const runtime = 'edge';

/**
 * Generic 1200×630 share card for pages without their own opengraph-image:
 * /og?t=<headline>&k=<kicker>&c=<channel>. Same frame as the homepage and
 * blog cards: brand and headline on white, a yellow panel on the right with
 * the channel's logo (or the bolt). Built by lib/seo's ogImagePath.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const title = (q.get('t') ?? 'Plan, write and publish everywhere you post.').slice(0, 110);
  const kicker = (q.get('k') ?? '').slice(0, 40);
  const channel = q.get('c') as BrandProvider | null;
  const brand = channel && BRAND_PATHS[channel] ? channel : null;
  const color = brand ? ((PROVIDER_META as Record<string, { color: string }>)[brand]?.color ?? INK) : INK;

  const [fonts, bolt] = await Promise.all([
    ogFonts(`Sosial${title}`, `${kicker}sosial.app`),
    ogPublic('bolt.png'),
  ]);
  const size = title.length > 70 ? 50 : title.length > 46 ? 58 : 66;

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
        <div
          style={{
            position: 'absolute',
            top: 44,
            right: -40,
            bottom: 44,
            width: 420,
            borderRadius: 48,
            background: ACCENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {brand ? (
            <div
              style={{
                width: 196,
                height: 196,
                marginRight: 40,
                borderRadius: 98,
                background: color,
                border: '8px solid #FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="96" height="96" viewBox="0 0 24 24" fill="#FFFFFF">
                {GLYPH_TRANSFORMS[brand] ? (
                  <g transform={GLYPH_TRANSFORMS[brand]}>
                    <path d={BRAND_PATHS[brand]} />
                  </g>
                ) : (
                  <path d={BRAND_PATHS[brand]} />
                )}
              </svg>
            </div>
          ) : bolt ? (
            <div
              style={{
                width: 196,
                height: 196,
                marginRight: 40,
                borderRadius: 98,
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={bolt as unknown as string} width={84} height={112} />
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', width: 760, padding: '64px 0 56px 72px' }}>
          <OgBrand bolt={bolt} />
          {kicker ? (
            <div
              style={{
                marginTop: 56,
                fontSize: 22,
                fontWeight: 500,
                color: MUTED,
                letterSpacing: 2.2,
                textTransform: 'uppercase',
                display: 'flex',
              }}
            >
              {kicker}
            </div>
          ) : null}
          <div
            style={{
              marginTop: kicker ? 18 : 64,
              fontSize: size,
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: -2,
              display: 'flex',
            }}
          >
            {title}
          </div>
          <div style={{ marginTop: 'auto', fontSize: 22, fontWeight: 500, color: MUTED, display: 'flex' }}>sosial.app</div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts,
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800' },
    },
  );
}
