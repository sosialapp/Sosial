import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: root,
  // Native module — keep it out of the server bundle so the platform picks the
  // right prebuilt binary (used by the server-side watermark compositor).
  serverExternalPackages: ['sharp'],
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
