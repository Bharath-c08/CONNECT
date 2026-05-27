import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // Allow remote devices on the local network to connect to the development server
  allowedDevOrigins: [
    '192.168.0.102',
    '192.168.0.112',
    'localhost',
  ],
};

export default nextConfig;
