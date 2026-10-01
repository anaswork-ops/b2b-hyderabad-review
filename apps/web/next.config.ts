import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  transpilePackages: ['@b2b/ui'],
  poweredByHeader: false,
  async rewrites() {
    const upstream = process.env.API_PROXY_ORIGIN;
    if (!upstream) {
      if (process.env.NEXT_PUBLIC_API_ORIGIN === '/api') {
        throw new Error(
          'API_PROXY_ORIGIN is required for same-origin API routing',
        );
      }
      return [];
    }
    const url = new URL(upstream);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        'API_PROXY_ORIGIN must be an HTTPS origin without credentials or a path',
      );
    }
    return [{ source: '/api/:path*', destination: `${url.origin}/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
