import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-hosted (Docker) output: .next/standalone ships the server plus only
  // the traced node_modules, so the runtime image needs no `npm install`.
  // Vercel ignores this setting.
  output: 'standalone',
  outputFileTracingRoot: root,
  images: {
    // AVIF first (roughly half the bytes of WebP for the hero render).
    formats: ['image/avif', 'image/webp'],
    // Portrait placeholders for the landing connect card.
    remotePatterns: [{ protocol: 'https', hostname: 'randomuser.me' }],
  },
  // Native module — keep it out of the server bundle so the platform picks the
  // right prebuilt binary (used by the server-side watermark compositor).
  serverExternalPackages: ['sharp'],
  async headers() {
    return [
      {
        // /public images (brand marks, bolt). Not content-hashed, so a day
        // fresh plus a week of background revalidation rather than immutable.
        source: '/:all*(svg|png|jpg|jpeg|webp|ico)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
  },
  async rewrites() {
    return [
      // Legacy GitHub Pages URLs — old links, app stores and SEO keep working.
      // The URL stays as-is; canonical remains /terms and /privacy.
      { source: '/terms.html', destination: '/terms' },
      { source: '/privacy.html', destination: '/privacy' },
    ];
  },
};

export default nextConfig;
