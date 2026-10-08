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
    <svg viewBox="0 0 59 59" aria-hidden="true">
      <path fill="#FBBC04" d="M14.75 13.41c8.146 0 14.75 6.603 14.75 14.75v1.34H1.34C.6 29.5 0 28.9 0 28.16c0-8.147 6.604-14.75 14.75-14.75z" />
      <path fill="#EA4335" d="M45.59 14.75c0 8.146-6.603 14.75-14.75 14.75H29.5V1.34C29.5.6 30.1 0 30.84 0c8.147 0 14.75 6.604 14.75 14.75z" />
      <path fill="#4285F4" d="M44.25 45.59c-8.146 0-14.75-6.603-14.75-14.75V29.5h28.16c.74 0 1.34.6 1.34 1.34 0 8.147-6.604 14.75-14.75 14.75z" />
      <path fill="#34A853" d="M13.41 44.25c0-8.146 6.603-14.75 14.75-14.75h1.34v28.16c0 .74-.6 1.34-1.34 1.34-8.147 0-14.75-6.604-14.75-14.75z" />
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

/**
 * AI-agent marks for the landing dock's "AI agents" panel (agents that can
 * operate Sosial through MCP). Real CC0 brand marks where one exists
 * (Claude, Gemini, Copilot, Cursor, Meta/Muse via simple-icons); honest
 * monogram tiles where no redistributable mark exists (ChatGPT, Dots,
 * Codex, Hermes, Clawbot) — never a fake lookalike logo.
 */
const MONO_TILE = (
  <rect width="24" height="24" rx="5.5" fill="#111111" />
);
const MONO_TEXT = 'system-ui, -apple-system, sans-serif';

export const AI_MARKS: Record<string, React.ReactNode> = {
  claude: (
    <svg viewBox="0 0 24 24" fill="#D97757" aria-hidden="true">
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  ),
  gemini: (
    <svg viewBox="0 0 24 24" fill="#8E75B2" aria-hidden="true">
      <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
    </svg>
  ),
  copilot: (
    <svg viewBox="0 0 24 24" fill="#111111" aria-hidden="true">
      <path d="M23.922 16.997C23.061 18.492 18.063 22.02 12 22.02 5.937 22.02.939 18.492.078 16.997A.641.641 0 0 1 0 16.741v-2.869a.883.883 0 0 1 .053-.22c.372-.935 1.347-2.292 2.605-2.656.167-.429.414-1.055.644-1.517a10.098 10.098 0 0 1-.052-1.086c0-1.331.282-2.499 1.132-3.368.397-.406.89-.717 1.474-.952C7.255 2.937 9.248 1.98 11.978 1.98c2.731 0 4.767.957 6.166 2.093.584.235 1.077.546 1.474.952.85.869 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086.23.462.477 1.088.644 1.517 1.258.364 2.233 1.721 2.605 2.656a.841.841 0 0 1 .053.22v2.869a.641.641 0 0 1-.078.256Zm-11.75-5.992h-.344a4.359 4.359 0 0 1-.355.508c-.77.947-1.918 1.492-3.508 1.492-1.725 0-2.989-.359-3.782-1.259a2.137 2.137 0 0 1-.085-.104L4 11.746v6.585c1.435.779 4.514 2.179 8 2.179 3.486 0 6.565-1.4 8-2.179v-6.585l-.098-.104s-.033.045-.085.104c-.793.9-2.057 1.259-3.782 1.259-1.59 0-2.738-.545-3.508-1.492a4.359 4.359 0 0 1-.355-.508Zm2.328 3.25c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm-5 0c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm3.313-6.185c.136 1.057.403 1.913.878 2.497.442.544 1.134.938 2.344.938 1.573 0 2.292-.337 2.657-.751.384-.435.558-1.15.558-2.361 0-1.14-.243-1.847-.705-2.319-.477-.488-1.319-.862-2.824-1.025-1.487-.161-2.192.138-2.533.529-.269.307-.437.808-.438 1.578v.021c0 .265.021.562.063.893Zm-1.626 0c.042-.331.063-.628.063-.894v-.02c-.001-.77-.169-1.271-.438-1.578-.341-.391-1.046-.69-2.533-.529-1.505.163-2.347.537-2.824 1.025-.462.472-.705 1.179-.705 2.319 0 1.211.175 1.926.558 2.361.365.414 1.084.751 2.657.751 1.21 0 1.902-.394 2.344-.938.475-.584.742-1.44.878-2.497Z" />
    </svg>
  ),
  cursor: (
    <svg viewBox="0 0 24 24" fill="#111111" aria-hidden="true">
      <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
    </svg>
  ),
  muse: (
    <svg viewBox="0 0 24 24" fill="#0467DF" aria-hidden="true">
      <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z" />
    </svg>
  ),
  chatgpt: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {MONO_TILE}
      <text x="12" y="16.2" textAnchor="middle" fontFamily={MONO_TEXT} fontWeight={800} fontSize="7" fill="#fff" letterSpacing="-0.3">GPT</text>
    </svg>
  ),
  dots: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {MONO_TILE}
      <circle cx="5.5" cy="12" r="2.4" fill="#fff" />
      <circle cx="12" cy="12" r="2.4" fill="#fff" />
      <circle cx="18.5" cy="12" r="2.4" fill="#fff" />
    </svg>
  ),
  codex: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {MONO_TILE}
      <text x="12" y="16.5" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight={700} fontSize="8.5" fill="#fff">{'</>'}</text>
    </svg>
  ),
  hermes: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {MONO_TILE}
      <text x="12" y="17.5" textAnchor="middle" fontFamily={MONO_TEXT} fontWeight={800} fontSize="13" fill="#fff">H</text>
    </svg>
  ),
  clawbot: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {MONO_TILE}
      <text x="12" y="16.5" textAnchor="middle" fontFamily={MONO_TEXT} fontWeight={800} fontSize="10" fill="#fff">Cl</text>
    </svg>
  ),
};

/** Sized AI-mark slot — mirrors SourceMark. */
export function AiMark({ id, className }: { id: string; className?: string }) {
  return (
    <span className={className ?? 'flex h-5 w-5 shrink-0 items-center justify-center [&_svg]:h-full [&_svg]:w-full'}>
      {AI_MARKS[id] ?? null}
    </span>
  );
}

/** Sized brand-mark slot — caller controls the box, the svg fills it. */
export function SourceMark({ id, className }: { id: string; className?: string }) {
  return (
    <span className={className ?? 'flex h-5 w-5 shrink-0 items-center justify-center [&_svg]:h-full [&_svg]:w-full'}>
      {BRAND_MARKS[id] ?? null}
    </span>
  );
}
