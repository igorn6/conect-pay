const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "next.config.ts");

const configCode = `import type { NextConfig } from "next";

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
`;

fs.writeFileSync(file, configCode);
console.log("Updated next.config.ts with redirects.");
