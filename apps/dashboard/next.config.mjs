/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@adwo/shared"],
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
