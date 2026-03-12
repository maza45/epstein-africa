/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    // better-sqlite3 is a native module — keep it external
    config.externals = [...(config.externals ?? []), "better-sqlite3"];
    return config;
  },
};

export default nextConfig;
