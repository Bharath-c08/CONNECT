import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow remote devices on the local network to connect to the development server
  allowedDevOrigins: [
    '192.168.0.102',
    'localhost',
  ],
};

export default nextConfig;
