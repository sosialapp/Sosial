import { ImageResponse } from 'next/og';
import { article } from '@/lib/blog';

export const runtime = 'edge';
export const alt = 'Sosial article';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Per-post social card: tag pill + headline on the brand ink. */
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await article(slug).catch(() => null);
  const title = post?.title ?? 'Sosial Blog';
  const tag = post?.tag ?? 'Social media';
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 96,
          background: '#1C1A14',
          color: '#F5F1E8',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: '#1C1A14',
              background: '#F2A400',
              borderRadius: 999,
              padding: '8px 24px',
            }}
          >
            {tag}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#B9B2A3' }}>Sosial Blog</div>
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: title.length > 70 ? 52 : 62,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -2,
            maxWidth: 1000,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </div>
      </div>
    ),
    { ...size },
  );
}
