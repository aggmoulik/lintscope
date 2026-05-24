/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@lintscope/ui', '@lintscope/schema'],
  experimental: {
    // App Router is default in Next 15 — no explicit flag needed.
  },
};

export default nextConfig;
