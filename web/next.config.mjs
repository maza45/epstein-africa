/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales: ["en", "fr"],
    defaultLocale: "en",
    localeDetection: false,
  },
  experimental: {
    outputFileTracingIncludes: {
      "/api/**": ["./data/**"],
      "/emails/**": ["./data/**"],
    },
  },
  webpack(config) {
    config.externals = [...(config.externals ?? []), "better-sqlite3"];
    return config;
  },
};

export default nextConfig;
