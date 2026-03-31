import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Include the SQLite DB in Vercel serverless function bundles
  outputFileTracingIncludes: {
    "/api/**": ["./data/epstein_africa.db"],
    "/emails/**": ["./data/epstein_africa.db"],
  },
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../"),
  },
  webpack(config) {
    // better-sqlite3 is a native module — keep it external
    config.externals = [...(config.externals ?? []), "better-sqlite3"];
    return config;
  },
};

export default nextConfig;
