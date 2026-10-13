import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Sosial, social media scheduler for every channel';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Default social card: dark ink, amber bolt mark, wordmark + pitch. */
export default function OgImage() {
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
              width: 72,
              height: 72,
              borderRadius: 20,
              background: '#F2A400',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              fontWeight: 900,
              color: '#1C1A14',
            }}
          >
            S
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>Sosial</div>
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: -2,
            maxWidth: 960,
          }}
        >
          Plan, write and publish across ten social networks.
        </div>
        <div style={{ marginTop: 28, fontSize: 30, color: '#B9B2A3' }}>
          One composer, calendar and queue, with an AI writer built in.
        </div>
      </div>
    ),
    { ...size },
  );
}
