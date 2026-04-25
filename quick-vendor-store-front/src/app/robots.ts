import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.appUrl;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/report/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
