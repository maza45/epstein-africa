/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/**": ["./data/epstein_africa.db"],
      "/emails/**": ["./data/epstein_africa.db"],
    },
  },
  webpack(config) {
    config.externals = [...(config.externals ?? []), "better-sqlite3"];
    return config;
  },
};

export default nextConfig;
