/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Make sure experimental features are disabled unless you specifically need them
  experimental: {
    // Disable any experimental features here
  }
}

module.exports = nextConfig