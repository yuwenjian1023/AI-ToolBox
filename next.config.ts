import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.3.94'],
  compress: false,
  serverExternalPackages: ['ali-oss', 'cheerio', 'better-sqlite3', 'pdf-parse', 'mammoth'],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
