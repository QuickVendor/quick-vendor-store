import type { NextConfig } from "next";

const appEnv = (
  process.env.NEXT_PUBLIC_APP_ENV ??
  process.env.APP_ENV ??
  (process.env.NODE_ENV === 'production' ? 'production' : 'local')
).toLowerCase();
const isLocal = appEnv === 'local';

// In local docker the backend serves uploads at /uploads/* over HTTP and
// next/image refuses to optimise from a private container hostname (Next 16
// rejects optimisation from non-public IPs). Skip optimisation locally; in
// staging/production uploads are absolute S3 URLs and optimise normally.
const unoptimized = isLocal || process.env.NEXT_IMAGE_UNOPTIMIZED === 'true';

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  images: {
    unoptimized,
    qualities: [50, 60, 75],
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '*.s3.*.amazonaws.com' },
    ],
  },
  // Proxy /uploads/* to the backend so images appear same-origin to the
  // browser (avoids CORS + private IP optimisation issues). Use the
  // internal hostname when running inside docker, otherwise the public URL.
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
