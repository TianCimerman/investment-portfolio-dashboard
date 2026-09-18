/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permit the development server's JavaScript chunks and HMR connection when
  // the dashboard is opened from another device on this local network.
  allowedDevOrigins: ['192.168.1.8', '192.168.1.130'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
