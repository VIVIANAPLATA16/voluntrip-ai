/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

module.exports = nextConfig;
