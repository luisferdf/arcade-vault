import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    "192.168.68.121",
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.app",
  ],
};

export default nextConfig;
