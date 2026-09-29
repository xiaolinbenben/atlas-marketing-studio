/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', '.prisma/client'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = { ...(config.resolve.alias || {}), 'node:crypto': false, crypto: false };
      config.resolve.fallback = { ...(config.resolve.fallback || {}), crypto: false, 'node:crypto': false };
    }
    return config;
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
