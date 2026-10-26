import { ImageResponse } from 'next/og';
import { article } from '@/lib/blog';
import { formatPostDate, type Category } from '@/content/types';
import { TAG_TONES } from '@/content/tones';
import { INK, MUTED, OG_SIZE, OgBrand, ogFonts, ogImage, ogPublic } from '@/lib/ogKit';

export const runtime = 'edge';
export const alt = 'Sosial article';
export const size = OG_SIZE;
export const contentType = 'image/png';

/**
 * Topic icons as raw Lucide paths (Send, Compass, Sparkles, Users, TrendingUp,
 * Box): lucide-react uses React context, which the metadata image can't run.
 */
const TAG_ICON_PATHS: Record<Category, string[]> = {
  Publishing: [
    'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z',
    'm21.854 2.147-10.94 10.939',
  ],
  Strategy: [
    'm16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z',
    'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0',
  ],
  AI: [
    'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
    'M20 3v4',
    'M22 5h-4',
    'M4 17v2',
    'M5 18H3',
  ],
  Teams: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  Growth: ['M22 7 13.5 15.5 8.5 10.5 2 17', 'M16 7h6v6'],
  Product: [
    'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
    'm3.3 7 8.7 5 8.7-5',
    'M12 22V12',
  ],
};


/**
 * Per-post social card, the homepage card's frame: brand on white, the topic
 * chip and headline on the left, the post's cover on a panel in its topic
 * tint on the right (the topic's icon when there is no usable cover).
 */
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await article(slug).catch(() => null);
  const title = post?.title ?? 'The Sosial blog';
  const tag: Category = post?.tag ?? 'Publishing';
  const tone = TAG_TONES[tag] ?? TAG_TONES.Publishing;
  const meta = post ? `${post.minutes} min read · ${formatPostDate(post.date)}` : 'Guides for people who run social';
  const iconPaths = TAG_ICON_PATHS[tag] ?? TAG_ICON_PATHS.Publishing;

  const [fonts, bolt, cover] = await Promise.all([
    ogFonts(`Sosial${title}${tag}Blog`, `${meta}sosial.app/blog`),
    ogPublic('bolt.png'),
    ogImage(post?.coverUrl),
  ]);
  // Long titles step down so three lines always fit.
  const titleSize = title.length > 80 ? 44 : title.length > 56 ? 50 : 58;

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
        {/* Right: the cover on the topic's tint, bleeding off the edge. */}
        <div
          style={{
            position: 'absolute',
            top: 44,
            right: -40,
            bottom: 44,
            width: 560,
            borderRadius: 48,
            background: tone.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: cover ? 'flex-start' : 'center',
            overflow: 'hidden',
          }}
        >
          {cover ? (
            <div
              style={{
                display: 'flex',
                marginLeft: 44,
                width: 620,
                height: 349,
                borderRadius: 24,
                overflow: 'hidden',
                boxShadow: '0 24px 60px -24px rgba(28,26,20,0.45)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={cover as unknown as string} width={620} height={349} style={{ objectFit: 'cover' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', marginRight: 40 }}>
              <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke={tone.ink} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                {iconPaths.map((d) => (
                  <path key={d} d={d} />
                ))}
              </svg>
            </div>
          )}
        </div>

        {/* Left: brand, topic, headline, length and date. */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 650, padding: '64px 0 60px 72px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <OgBrand bolt={bolt} size={34} />
            <div style={{ fontSize: 34, fontWeight: 500, color: MUTED, display: 'flex' }}>Blog</div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                padding: '8px 18px',
                borderRadius: 999,
                background: tone.bg,
                color: tone.ink,
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              {tag}
            </div>
            <div
              style={{
                marginTop: 22,
                fontSize: titleSize,
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: -1.8,
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {title}
            </div>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 28, display: 'flex', alignItems: 'center', gap: 16, fontSize: 21, fontWeight: 500, color: MUTED }}>
            <div style={{ display: 'flex' }}>{meta}</div>
            <div style={{ display: 'flex', width: 5, height: 5, borderRadius: 3, background: '#C9C3B6' }} />
            <div style={{ display: 'flex' }}>sosial.app/blog</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
