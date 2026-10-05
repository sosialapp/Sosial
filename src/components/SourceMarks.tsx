import React from 'react';
import Svg, { Path, G, Mask, Defs, LinearGradient, RadialGradient, Stop, ClipPath, Rect } from 'react-native-svg';

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
    <Svg width={size} height={size} viewBox="0 0 59 59">
      <Path fill="#FBBC04" d="M14.75 13.41c8.146 0 14.75 6.603 14.75 14.75v1.34H1.34C.6 29.5 0 28.9 0 28.16c0-8.147 6.604-14.75 14.75-14.75z" />
      <Path fill="#EA4335" d="M45.59 14.75c0 8.146-6.603 14.75-14.75 14.75H29.5V1.34C29.5.6 30.1 0 30.84 0c8.147 0 14.75 6.604 14.75 14.75z" />
      <Path fill="#4285F4" d="M44.25 45.59c-8.146 0-14.75-6.603-14.75-14.75V29.5h28.16c.74 0 1.34.6 1.34 1.34 0 8.147-6.604 14.75-14.75 14.75z" />
      <Path fill="#34A853" d="M13.41 44.25c0-8.146 6.603-14.75 14.75-14.75h1.34v28.16c0 .74-.6 1.34-1.34 1.34-8.147 0-14.75-6.604-14.75-14.75z" />
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
      <Defs>
        <RadialGradient id="m-cv-p0" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(15.453 70.9057) rotate(-49.416) scale(61.8733)">
          <Stop stopColor="#6420FF" />
          <Stop offset="1" stopColor="#6420FF" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="m-cv-p1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(21.1788 9.09457) rotate(54.703) scale(69.7735)">
          <Stop stopColor="#00C4CC" />
          <Stop offset="1" stopColor="#00C4CC" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="m-cv-p2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(15.4526 70.9053) rotate(-45.1954) scale(61.1242 28.1118)">
          <Stop stopColor="#6420FF" />
          <Stop offset="1" stopColor="#6420FF" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="m-cv-p3" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32.7158 10.7789) rotate(66.5198) scale(62.9836 105.512)">
          <Stop stopColor="#00C4CC" stopOpacity="0.725916" />
          <Stop offset="0.0001" stopColor="#00C4CC" />
          <Stop offset="1" stopColor="#00C4CC" stopOpacity="0" />
        </RadialGradient>
        <ClipPath id="m-cv-clip">
          <Rect width="80" height="80" fill="white" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#m-cv-clip)">
        <Path d="M40 80C62.0914 80 80 62.0914 80 40C80 17.9086 62.0914 0 40 0C17.9086 0 0 17.9086 0 40C0 62.0914 17.9086 80 40 80Z" fill="#7D2AE7" />
        <Path d="M40 80C62.0914 80 80 62.0914 80 40C80 17.9086 62.0914 0 40 0C17.9086 0 0 17.9086 0 40C0 62.0914 17.9086 80 40 80Z" fill="url(#m-cv-p0)" />
        <Path d="M40 80C62.0914 80 80 62.0914 80 40C80 17.9086 62.0914 0 40 0C17.9086 0 0 17.9086 0 40C0 62.0914 17.9086 80 40 80Z" fill="url(#m-cv-p1)" />
        <Path d="M40 80C62.0914 80 80 62.0914 80 40C80 17.9086 62.0914 0 40 0C17.9086 0 0 17.9086 0 40C0 62.0914 17.9086 80 40 80Z" fill="url(#m-cv-p2)" />
        <Path d="M40 80C62.0914 80 80 62.0914 80 40C80 17.9086 62.0914 0 40 0C17.9086 0 0 17.9086 0 40C0 62.0914 17.9086 80 40 80Z" fill="url(#m-cv-p3)" />
        <Path
          fill="#fff"
          d="M57.2691 48.2052C56.939 48.2052 56.6485 48.484 56.3462 49.0928C52.9323 56.0153 47.0358 60.9134 40.2125 60.9134C32.3228 60.9134 27.437 53.7913 27.437 43.9522C27.437 27.2855 36.7232 17.6491 44.8796 17.6491C48.691 17.6491 51.0186 20.0443 51.0186 23.8559C51.0186 28.3796 48.4485 30.7748 48.4485 32.3702C48.4485 33.0864 48.8939 33.5201 49.7773 33.5201C53.3264 33.5201 57.4918 29.4419 57.4918 23.6808C57.4918 18.0947 52.63 13.9888 44.4737 13.9888C30.994 13.9888 19.0142 26.4858 19.0142 43.777C19.0142 57.1614 26.6572 66.0061 38.45 66.0061C50.9668 66.0061 58.2043 53.5526 58.2043 49.5105C58.2043 48.6153 57.7466 48.2052 57.2691 48.2052Z"
        />
      </G>
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
