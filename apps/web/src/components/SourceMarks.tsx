'use client';

import { ImagePlus } from 'lucide-react';

/** Real brand marks (thesvg.org, CC0) — shared by the composer dropdown and
 *  the Connect integrations tab. No hand-drawn glyphs. */
export const BRAND_MARKS: Record<string, React.ReactNode> = {
  drive: (
    <svg viewBox="0 0 800 742" fill="none" aria-hidden="true">
      <mask id="drv-m" maskUnits="userSpaceOnUse" x="12" y="18" width="168" height="154">
        <path fill="#fff" d="M63.09 37c14.626-25.333 51.193-25.334 65.819 0l45.033 78c14.626 25.334-3.657 57.001-32.91 57.001H50.967c-29.253 0-47.536-31.667-32.91-57.001Z" />
      </mask>
      <g mask="url(#drv-m)" transform="matrix(4.8140532,0,0,4.8140532,-62.146701,-86.652356)">
        <path fill="url(#drv-y)" d="M206.905 172.02h-91.888l-19.015-32.934 45.944-79.578Z" />
        <path fill="url(#drv-b)" d="M-14.919 172.006 50.04 59.494v.002L31.032 92.422h38.02L115 172.004l-129.918.001Z" />
        <path fill="url(#drv-g)" d="M96.007-20.085 141.954 59.5l-19.011 32.928H31.048Z" />
      </g>
      <defs>
        <linearGradient id="drv-y" x1="193.6" x2="103.09" y1="165.6" y2="111.21" gradientUnits="userSpaceOnUse">
          <stop offset=".09" stop-color="#ffe921" />
          <stop offset="1" stop-color="#fec700" />
        </linearGradient>
        <linearGradient id="drv-b" x1="114.4" x2="15.53" y1="181.61" y2="121.8" gradientUnits="userSpaceOnUse">
          <stop offset=".15" stop-color="#a9a8ff" />
          <stop offset=".33" stop-color="#6d97ff" />
          <stop offset=".48" stop-color="#3186ff" />
        </linearGradient>
        <linearGradient id="drv-g" x1="128.88" x2="28.7" y1="37.88" y2="84.64" gradientUnits="userSpaceOnUse">
          <stop offset=".55" stop-color="#0ebc5f" />
          <stop offset=".85" stop-color="#78c9ff" />
        </linearGradient>
      </defs>
    </svg>
  ),
  gphotos: (
    <svg viewBox="0 0 24 24" fill="#4285F4" aria-hidden="true">
      <path d="M12.678 16.672c0 2.175.002 4.565-.001 6.494-.001.576-.244.814-.817.833-7.045.078-8.927-7.871-4.468-11.334-1.95.016-4.019.007-5.986.007-1.351 0-1.414-.01-1.405-1.351.258-6.583 7.946-8.275 11.323-3.936L11.308.928c-.001-.695.212-.906.906-.925 6.409-.187 9.16 7.308 4.426 11.326l6.131.002c1.097 0 1.241.105 1.228 1.217-.223 6.723-7.802 8.376-11.321 4.124zm.002-15.284-.003 9.972c6.56-.465 6.598-9.532.003-9.972zm-1.36 21.224-.001-9.97c-6.927.598-6.29 9.726.002 9.97zM1.4 11.315l9.95.008c-.527-6.829-9.762-6.367-9.95-.008zm11.238 1.365c.682 6.875 9.67 6.284 9.977.01z" />
    </svg>
  ),
  dropbox: (
    <svg viewBox="0 0 24 24" fill="#0061FF" aria-hidden="true">
      <path d="M6 1.807 0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z" />
    </svg>
  ),
  unsplash: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7.5 6.75V0h9v6.75h-9zm9 3.75H24V24H0V10.5h7.5v6.75h9V10.5z" />
    </svg>
  ),
  onedrive: (
    <svg viewBox="0 0 1000 615" aria-hidden="true">
      <defs>
        <radialGradient id="od-a" cx="-446.23" cy="850.24" r="6.99" fx="-446.23" fy="850.24" gradientTransform="matrix(28.87975 32.00675 53.69646 -48.39975 -32750.77 55564.7)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4894fe" /><stop offset=".7" stop-color="#0934b3" /></radialGradient>
        <radialGradient id="od-b" cx="-463.71" cy="855.09" r="6.99" fx="-463.71" fy="855.09" gradientTransform="matrix(-126.93754 135.45874 101.23704 94.7798 -144561.83 -18444.24)" gradientUnits="userSpaceOnUse"><stop offset=".17" stop-color="#23c0fe" /><stop offset=".53" stop-color="#1c91ff" /></radialGradient>
        <radialGradient id="od-c" cx="-478.67" cy="847.12" r="6.99" fx="-478.67" fy="847.12" gradientTransform="matrix(-30.17956 -23.43498 -52.80172 67.93278 30509.91 -68620.88)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" /><stop offset=".66" stop-color="#adc0ff" stop-opacity="0" /></radialGradient>
        <radialGradient id="od-d" cx="-484.89" cy="847.31" r="6.99" fx="-484.89" fy="847.31" gradientTransform="matrix(-33.90072 -26.53382 -39.69188 50.66325 17714.49 -55348.26)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#033acc" /><stop offset="1" stop-color="#368eff" stop-opacity="0" /></radialGradient>
        <radialGradient id="od-e" cx="-454.42" cy="853.18" r="6.99" fx="-454.42" fy="853.18" gradientTransform="matrix(38.74213 82.7056 94.03873 -44.01576 -62416.51 75114.97)" gradientUnits="userSpaceOnUse"><stop offset=".59" stop-color="#3464e3" stop-opacity="0" /><stop offset="1" stop-color="#033acc" /></radialGradient>
        <radialGradient id="od-f" cx="-465.3" cy="852.63" r="6.99" fx="-465.3" fy="852.63" gradientTransform="matrix(-101.35519 93.7574 146.5162 158.24743 -171232.53 -91444.13)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4bfde8" /><stop offset=".54" stop-color="#4bfde8" stop-opacity="0" /></radialGradient>
        <radialGradient id="od-h" cx="-445.42" cy="847.35" r="6.99" fx="-445.42" fy="847.35" gradientTransform="matrix(60.3777 22.14291 39.59688 -107.87213 -6264.92 101508.79)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" /><stop offset=".79" stop-color="#fff" stop-opacity="0" /></radialGradient>
        <radialGradient id="od-i" cx="-468.67" cy="861.39" r="6.99" fx="-468.67" fy="861.39" gradientTransform="matrix(-67.45933 53.77501 53.21816 66.68832 -76468.45 -32083.78)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4bfde8" /><stop offset=".58" stop-color="#4bfde8" stop-opacity="0" /></radialGradient>
        <linearGradient id="od-g" x1="638.67" x2="638.67" y1="2.44" y2="421.76" gradientTransform="matrix(1 0 0 -1 0 617.01)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0086ff" /><stop offset=".49" stop-color="#0bf" /></linearGradient>
      </defs>
      <path d="M276.36 94.08C123.48 94.08 9.21 209.84.6 338.79c5.33 27.79 22.83 82.65 50.24 79.84 34.26-3.52 120.56 0 194.17-123.26 53.77-90.04 164.37-201.29 31.35-201.29Z" fill="url(#od-a)" />
      <path d="M240.99 142.19c-51.39 75.26-120.56 183.1-143.91 217.03-27.75 40.34-101.25 23.2-95.16-34.62a237.4 237.4 0 0 0-1.38 14.19C-9.51 489.22 119.43 614.14 279.88 614.14c176.84 0 598.58-203.81 555.9-408.02C790.8 86.1 664.36 0 521.07 0S285.94 76.36 241 142.19Z" fill="url(#od-b)" />
      <path d="M240.99 142.19c-51.39 75.26-120.56 183.1-143.91 217.03-27.75 40.34-101.25 23.2-95.16-34.62a237.4 237.4 0 0 0-1.38 14.19C-9.51 489.22 119.43 614.14 279.88 614.14c176.84 0 598.58-203.81 555.9-408.02C790.8 86.1 664.36 0 521.07 0S285.94 76.36 241 142.19Z" fillOpacity=".4" fill="url(#od-c)" />
      <path d="M240.99 142.19c-51.39 75.26-120.56 183.1-143.91 217.03-27.75 40.34-101.25 23.2-95.16-34.62a237.4 237.4 0 0 0-1.38 14.19C-9.51 489.22 119.43 614.14 279.88 614.14c176.84 0 598.58-203.81 555.9-408.02C790.8 86.1 664.36 0 521.07 0S285.94 76.36 241 142.19Z" fill="url(#od-d)" />
      <path d="M240.99 142.19c-51.39 75.26-120.56 183.1-143.91 217.03-27.75 40.34-101.25 23.2-95.16-34.62a237.4 237.4 0 0 0-1.38 14.19C-9.51 489.22 119.43 614.14 279.88 614.14c176.84 0 598.58-203.81 555.9-408.02C790.8 86.1 664.36 0 521.07 0S285.94 76.36 241 142.19Z" fillOpacity=".6" fill="url(#od-e)" />
      <path d="M240.99 142.19c-51.39 75.26-120.56 183.1-143.91 217.03-27.75 40.34-101.25 23.2-95.16-34.62a237.4 237.4 0 0 0-1.38 14.19C-9.51 489.22 119.43 614.14 279.88 614.14c176.84 0 598.58-203.81 555.9-408.02C790.8 86.1 664.36 0 521.07 0S285.94 76.36 241 142.19Z" fillOpacity=".9" fill="url(#od-f)" />
      <path d="M277.34 614.23s422.24.77 493.86.77c129.97 0 228.8-98.16 228.8-212.69s-100.8-212.1-228.8-212.1-201.7 88.57-257.06 185.25c-64.87 113.29-147.62 237.41-236.8 238.77Z" fill="url(#od-g)" />
      <path d="M277.34 614.23s422.24.77 493.86.77c129.97 0 228.8-98.16 228.8-212.69s-100.8-212.1-228.8-212.1-201.7 88.57-257.06 185.25c-64.87 113.29-147.62 237.41-236.8 238.77Z" fillOpacity=".4" fill="url(#od-h)" />
      <path d="M277.34 614.23s422.24.77 493.86.77c129.97 0 228.8-98.16 228.8-212.69s-100.8-212.1-228.8-212.1-201.7 88.57-257.06 185.25c-64.87 113.29-147.62 237.41-236.8 238.77Z" fillOpacity=".9" fill="url(#od-i)" />
    </svg>
  ),
  canva: (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <g clipPath="url(#cv-clip)">
        <path d="M40 80C62.0914 80 80 62.0914 80 40C80 17.9086 62.0914 0 40 0C17.9086 0 0 17.9086 0 40C0 62.0914 17.9086 80 40 80Z" fill="#7D2AE7" />
        <path d="M40 80C62.0914 80 80 62.0914 80 40C80 17.9086 62.0914 0 40 0C17.9086 0 0 17.9086 0 40C0 62.0914 17.9086 80 40 80Z" fill="url(#cv-p0)" />
        <path d="M40 80C62.0914 80 80 62.0914 80 40C80 17.9086 62.0914 0 40 0C17.9086 0 0 17.9086 0 40C0 62.0914 17.9086 80 40 80Z" fill="url(#cv-p1)" />
        <path d="M40 80C62.0914 80 80 62.0914 80 40C80 17.9086 62.0914 0 40 0C17.9086 0 0 17.9086 0 40C0 62.0914 17.9086 80 40 80Z" fill="url(#cv-p2)" />
        <path d="M40 80C62.0914 80 80 62.0914 80 40C80 17.9086 62.0914 0 40 0C17.9086 0 0 17.9086 0 40C0 62.0914 17.9086 80 40 80Z" fill="url(#cv-p3)" />
        <path d="M57.2691 48.2052C56.939 48.2052 56.6485 48.484 56.3462 49.0928C52.9323 56.0153 47.0358 60.9134 40.2125 60.9134C32.3228 60.9134 27.437 53.7913 27.437 43.9522C27.437 27.2855 36.7232 17.6491 44.8796 17.6491C48.691 17.6491 51.0186 20.0443 51.0186 23.8559C51.0186 28.3796 48.4485 30.7748 48.4485 32.3702C48.4485 33.0864 48.8939 33.5201 49.7773 33.5201C53.3264 33.5201 57.4918 29.4419 57.4918 23.6808C57.4918 18.0947 52.63 13.9888 44.4737 13.9888C30.994 13.9888 19.0142 26.4858 19.0142 43.777C19.0142 57.1614 26.6572 66.0061 38.45 66.0061C50.9668 66.0061 58.2043 53.5526 58.2043 49.5105C58.2043 48.6153 57.7466 48.2052 57.2691 48.2052Z" fill="white" />
      </g>
      <defs>
        <radialGradient id="cv-p0" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(15.453 70.9057) rotate(-49.416) scale(61.8733)">
          <stop stopColor="#6420FF" />
          <stop offset="1" stopColor="#6420FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cv-p1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(21.1788 9.09457) rotate(54.703) scale(69.7735)">
          <stop stopColor="#00C4CC" />
          <stop offset="1" stopColor="#00C4CC" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cv-p2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(15.4526 70.9053) rotate(-45.1954) scale(61.1242 28.1118)">
          <stop stopColor="#6420FF" />
          <stop offset="1" stopColor="#6420FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cv-p3" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32.7158 10.7789) rotate(66.5198) scale(62.9836 105.512)">
          <stop stopColor="#00C4CC" stopOpacity="0.725916" />
          <stop offset="0.0001" stopColor="#00C4CC" />
          <stop offset="1" stopColor="#00C4CC" stopOpacity="0" />
        </radialGradient>
        <clipPath id="cv-clip">
          <rect width="80" height="80" fill="white" />
        </clipPath>
      </defs>
    </svg>
  ),
};

export const LOCAL_ICON = <ImagePlus className="h-4 w-4" aria-hidden="true" />;

/** Sized brand-mark slot — caller controls the box, the svg fills it. */
export function SourceMark({ id, className }: { id: string; className?: string }) {
  return (
    <span className={className ?? 'flex h-5 w-5 shrink-0 items-center justify-center [&_svg]:h-full [&_svg]:w-full'}>
      {BRAND_MARKS[id] ?? null}
    </span>
  );
}
