import React from 'react';
import Svg, { Path, G, Mask, Defs, LinearGradient, RadialGradient, Stop, Circle } from 'react-native-svg';

/** Real brand marks (thesvg.org, CC0) for the integrations rows + composer
 *  tiles. No hand-drawn glyphs. Gradient/mask ids are namespaced per mark so
 *  concurrent instances never collide. */
function DriveMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 800 742">
      <Defs>
        <LinearGradient id="m-drv-y" x1="193.6" x2="103.09" y1="165.6" y2="111.21" gradientUnits="userSpaceOnUse">
          <Stop offset="0.09" stopColor="#ffe921" />
          <Stop offset="1" stopColor="#fec700" />
        </LinearGradient>
        <LinearGradient id="m-drv-b" x1="114.4" x2="15.53" y1="181.61" y2="121.8" gradientUnits="userSpaceOnUse">
          <Stop offset="0.15" stopColor="#a9a8ff" />
          <Stop offset="0.33" stopColor="#6d97ff" />
          <Stop offset="0.48" stopColor="#3186ff" />
        </LinearGradient>
        <LinearGradient id="m-drv-g" x1="128.88" x2="28.7" y1="37.88" y2="84.64" gradientUnits="userSpaceOnUse">
          <Stop offset="0.55" stopColor="#0ebc5f" />
          <Stop offset="0.85" stopColor="#78c9ff" />
        </LinearGradient>
      </Defs>
      <Mask id="m-drv-m" maskUnits="userSpaceOnUse" x="12" y="18" width="168" height="154">
        <Path fill="#fff" d="M63.09 37c14.626-25.333 51.193-25.334 65.819 0l45.033 78c14.626 25.334-3.657 57.001-32.91 57.001H50.967c-29.253 0-47.536-31.667-32.91-57.001Z" />
      </Mask>
      <G mask="url(#m-drv-m)" transform="matrix(4.8140532,0,0,4.8140532,-62.146701,-86.652356)">
        <Path fill="url(#m-drv-y)" d="M206.905 172.02h-91.888l-19.015-32.934 45.944-79.578Z" />
        <Path fill="url(#m-drv-b)" d="M-14.919 172.006 50.04 59.494v.002L31.032 92.422h38.02L115 172.004l-129.918.001Z" />
        <Path fill="url(#m-drv-g)" d="M96.007-20.085 141.954 59.5l-19.011 32.928H31.048Z" />
      </G>
    </Svg>
  );
}

function PhotosMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M12.678 16.672c0 2.175.002 4.565-.001 6.494-.001.576-.244.814-.817.833-7.045.078-8.927-7.871-4.468-11.334-1.95.016-4.019.007-5.986.007-1.351 0-1.414-.01-1.405-1.351.258-6.583 7.946-8.275 11.323-3.936L11.308.928c-.001-.695.212-.906.906-.925 6.409-.187 9.16 7.308 4.426 11.326l6.131.002c1.097 0 1.241.105 1.228 1.217-.223 6.723-7.802 8.376-11.321 4.124zm.002-15.284-.003 9.972c6.56-.465 6.598-9.532.003-9.972zm-1.36 21.224-.001-9.97c-6.927.598-6.29 9.726.002 9.97zM1.4 11.315l9.95.008c-.527-6.829-9.762-6.367-9.95-.008zm11.238 1.365c.682 6.875 9.67 6.284 9.977.01z"
      />
    </Svg>
  );
}

function DropboxMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#0061FF"
        d="M6 1.807 0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z"
      />
    </Svg>
  );
}

function UnsplashMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M7.5 6.75V0h9v6.75h-9zm9 3.75H24V24H0V10.5h7.5v6.75h9V10.5z" />
    </Svg>
  );
}

function CanvaMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Circle cx="40" cy="40" r="40" fill="#7D2AE7" />
      <Path
        fill="#fff"
        d="M57.3 48.2c-.3 0-.6.3-.9.9-3.5 6.9-9.4 11.8-16.2 11.8-7.9 0-12.8-7.1-12.8-16.9 0-16.7 9.3-26.3 17.5-26.3 3.8 0 6.1 2.4 6.1 6.2 0 4.5-2.6 6.9-2.6 8.5 0 .7.5 1.1 1.4 1.1 3.5 0 7.7-4.1 7.7-9.8 0-5.6-4.9-9.7-13-9.7-13.5 0-25.5 12.5-25.5 29.8 0 13.4 7.7 22.2 19.5 22.2 12.5 0 19.7-12.4 19.7-16.5 0-.9-.4-1.3-.9-1.3Z"
      />
    </Svg>
  );
}

function OneDriveMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * 0.615} viewBox="0 0 1000 615">
      <Defs>
        <RadialGradient id="m-od-a" cx="-446.23" cy="850.24" r="6.99" fx="-446.23" fy="850.24" gradientTransform="matrix(28.87975 32.00675 53.69646 -48.39975 -32750.77 55564.7)" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#4894fe" />
          <Stop offset="0.7" stopColor="#0934b3" />
        </RadialGradient>
        <RadialGradient id="m-od-b" cx="-463.71" cy="855.09" r="6.99" fx="-463.71" fy="855.09" gradientTransform="matrix(-126.93754 135.45874 101.23704 94.7798 -144561.83 -18444.24)" gradientUnits="userSpaceOnUse">
          <Stop offset="0.17" stopColor="#23c0fe" />
          <Stop offset="0.53" stopColor="#1c91ff" />
        </RadialGradient>
        <LinearGradient id="m-od-g" x1="638.67" x2="638.67" y1="2.44" y2="421.76" gradientTransform="matrix(1 0 0 -1 0 617.01)" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#0086ff" />
          <Stop offset="0.49" stopColor="#0bf" />
        </LinearGradient>
      </Defs>
      <Path d="M276.36 94.08C123.48 94.08 9.21 209.84.6 338.79c5.33 27.79 22.83 82.65 50.24 79.84 34.26-3.52 120.56 0 194.17-123.26 53.77-90.04 164.37-201.29 31.35-201.29Z" fill="url(#m-od-a)" />
      <Path d="M240.99 142.19c-51.39 75.26-120.56 183.1-143.91 217.03-27.75 40.34-101.25 23.2-95.16-34.62a237.4 237.4 0 0 0-1.38 14.19C-9.51 489.22 119.43 614.14 279.88 614.14c176.84 0 598.58-203.81 555.9-408.02C790.8 86.1 664.36 0 521.07 0S285.94 76.36 241 142.19Z" fill="url(#m-od-b)" />
      <Path d="M277.34 614.23s422.24.77 493.86.77c129.97 0 228.8-98.16 228.8-212.69s-100.8-212.1-228.8-212.1-201.7 88.57-257.06 185.25c-64.87 113.29-147.62 237.41-236.8 238.77Z" fill="url(#m-od-g)" />
    </Svg>
  );
}

export type SourceMarkId = 'drive' | 'gphotos' | 'dropbox' | 'unsplash' | 'canva' | 'onedrive';

/** Sized brand-mark slot for integration rows. */
export default function SourceMark({ id, size = 22, color = '#111111' }: { id: SourceMarkId; size?: number; color?: string }) {
  switch (id) {
    case 'drive':
      return <DriveMark size={size} />;
    case 'gphotos':
      return <PhotosMark size={size} />;
    case 'dropbox':
      return <DropboxMark size={size} />;
    case 'unsplash':
      return <UnsplashMark size={size} color={color} />;
    case 'canva':
      return <CanvaMark size={size} />;
    case 'onedrive':
      return <OneDriveMark size={size} />;
  }
}
