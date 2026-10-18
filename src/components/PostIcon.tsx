import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** EOS "content-modified" mark (document + pencil) for the Post tab. */
export default function PostIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="m21.558 3.592l-1.15-1.15a1.49 1.49 0 0 0-2.12 0L13 7.731V11h3.27l5.288-5.288a1.49 1.49 0 0 0 0-2.12M15.579 9.45h-1.03V8.42L18 4.973l1.03 1.03Z"
      />
      <Path
        fill={color}
        d="M19 19H5V5h6V3H5a2.006 2.006 0 0 0-2 2v14a2.006 2.006 0 0 0 2 2h14a2.006 2.006 0 0 0 2-2v-6h-2Z"
      />
    </Svg>
  );
}
