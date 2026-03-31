/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Include the SQLite DB in Vercel serverless function bundles
    outputFileTracingIncludes: {
      "/api/**": ["./data/epstein_africa.db"],
      "/emails/**": ["./data/epstein_africa.db"],
    },
  },
  webpack(config) {
    // better-sqlite3 is a native module — keep it external
    config.externals = [...(config.externals ?? []), "better-sqlite3"];
    return config;
  },
};

export default nextConfig;
