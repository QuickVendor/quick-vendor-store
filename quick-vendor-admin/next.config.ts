import type { NextConfig } from 'next';

const appEnv = (
  process.env.NEXT_PUBLIC_APP_ENV ??
  process.env.APP_ENV ??
  (process.env.NODE_ENV === 'production' ? 'production' : 'local')
).toLowerCase();
const isLocal = appEnv === 'local';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: isLocal || process.env.NEXT_IMAGE_UNOPTIMIZED === 'true',
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '*.s3.*.amazonaws.com' },
    ],
  },
  // Same /uploads/* proxy pattern as the storefront so admin previews of
  // vendor images stay same-origin in local docker.
  async rewrites() {
    const apiUrl =
      process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return [];
    return [
      {
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
