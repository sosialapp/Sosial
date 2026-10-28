import { ImageResponse } from 'next/og';
import { ogPublic } from '@/lib/ogKit';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Square home-screen icon: the bolt centred on white (bolt.png itself is 3:4). */
export default async function AppleIcon() {
  const bolt = await ogPublic('bolt.png');
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}>
        {bolt ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={bolt as unknown as string} width={93} height={124} />
        ) : null}
      </div>
    ),
    size,
  );
}
