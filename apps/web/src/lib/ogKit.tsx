import { BRAND_PATHS, GLYPH_TRANSFORMS, type BrandProvider } from '@/components/BrandIcon';
import { PROVIDER_META } from '@/lib/providers';

/**
 * Shared pieces for the edge-rendered link previews (opengraph-image routes):
 * the brand palette, the Plus Jakarta Sans loader, image fetching and the
 * channel logo strip. Satori quirks to remember: every element with more than
 * one child needs display:flex, and it only decodes PNG / JPEG.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const INK = '#1C1A14';
export const MUTED = '#6B655A';
export const ACCENT = '#FFC62E';

/** Plus Jakarta Sans from Google Fonts (TTF, which satori reads); null falls back to the default face. */
async function jakarta(weight: 500 | 800, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@${weight}&text=${encodeURIComponent(text)}`)
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

/** Both weights, subset to the text the card prints, ready for ImageResponse's `fonts`. */
export async function ogFonts(boldText: string, regularText: string) {
  const [bold, regular] = await Promise.all([jakarta(800, boldText), jakarta(500, regularText)]);
  return [
    ...(bold ? [{ name: 'Jakarta', data: bold, weight: 800 as const, style: 'normal' as const }] : []),
    ...(regular ? [{ name: 'Jakarta', data: regular, weight: 500 as const, style: 'normal' as const }] : []),
  ];
}

/** Any PNG/JPEG by URL; null on failure or a format satori can't decode (WebP, AVIF). */
export async function ogImage(url: string | null | undefined): Promise<ArrayBuffer | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    const type = r.headers.get('content-type') ?? '';
    if (!r.ok || !/image\/(png|jpe?g)/.test(type)) return null;
    return await r.arrayBuffer();
  } catch {
    return null;
  }
}

/** A file from public/, fetched from the site itself (edge can't read the disk), then the live site. */
export async function ogPublic(file: string): Promise<ArrayBuffer | null> {
  for (const base of [process.env.NEXT_PUBLIC_SITE_URL, 'https://sosial.app']) {
    if (!base) continue;
    const data = await ogImage(new URL(`/${file}`, base).toString());
    if (data) return data;
  }
  return null;
}

/** ⚡ logo + wordmark, the top-left of every card. */
export function OgBrand({ bolt, size = 38 }: { bolt: ArrayBuffer | null; size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.37) }}>
      {bolt ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={bolt as unknown as string} width={Math.round(size * 0.87)} height={Math.round(size * 1.16)} />
      ) : null}
      <div style={{ fontSize: size, fontWeight: 800, letterSpacing: -1 }}>Sosial</div>
    </div>
  );
}

/** Channel logo discs, overlapping, with a "+N" bubble for the rest. */
export function OgChannels({ shown, total, disc = 50 }: { shown: BrandProvider[]; total: number; disc?: number }) {
  const glyph = Math.round(disc * 0.48);
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <div
          key={p}
          style={{
            width: disc,
            height: disc,
            marginLeft: i ? -8 : 0,
            borderRadius: disc / 2,
            border: '3px solid #FFFFFF',
            background: (PROVIDER_META as Record<string, { color: string }>)[p]?.color ?? INK,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="#FFFFFF">
            {GLYPH_TRANSFORMS[p] ? (
              <g transform={GLYPH_TRANSFORMS[p]}>
                <path d={BRAND_PATHS[p]} />
              </g>
            ) : (
              <path d={BRAND_PATHS[p]} />
            )}
          </svg>
        </div>
      ))}
      {total > shown.length ? (
        <div
          style={{
            height: disc,
            marginLeft: -8,
            padding: '0 16px',
            borderRadius: disc / 2,
            border: '3px solid #FFFFFF',
            background: '#F1EEE6',
            display: 'flex',
            alignItems: 'center',
            fontSize: Math.round(disc * 0.4),
            fontWeight: 800,
          }}
        >
          +{total - shown.length}
        </div>
      ) : null}
    </div>
  );
}
