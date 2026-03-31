import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/**": [path.join(__dirname, "data/epstein_africa.db")],
      "/emails/**": [path.join(__dirname, "data/epstein_africa.db")],
    },
  },
  webpack(config) {
    config.externals = [...(config.externals ?? []), "better-sqlite3"];
    return config;
  },
};

export default nextConfig;
