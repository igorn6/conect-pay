import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/usuarios',
        destination: '/configuracoes',
        permanent: true,
      },
      {
        source: '/exportacao',
        destination: '/configuracoes',
        permanent: true,
      }
    ];
  },
};

export default nextConfig;
