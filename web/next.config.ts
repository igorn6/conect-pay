import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
