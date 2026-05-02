import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "wow.zamimg.com" }],
  },
};

export default nextConfig;
