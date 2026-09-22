import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      {source: '/admin', destination: '/', permanent: false},
      {source: '/admin/voters', destination: '/', permanent: false},
      {source: '/admin/elections/:path*', destination: '/elections/:path*', permanent: false},
      {source: '/admin/nominations/:path*', destination: '/nominations/:path*', permanent: false},
      {source: '/admin/results/:path*', destination: '/live-results/:path*', permanent: false},
      {source: '/admin/audit', destination: '/audit', permanent: false},
    ];
  },
};

export default nextConfig;
