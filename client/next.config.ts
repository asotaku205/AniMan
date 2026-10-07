import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiOrigin = (
      process.env.AUTH_API_URL ?? "http://localhost:8080"
    ).replace(/\/+$/, "");

    return [
      {
        source: "/auth/:path*",
        destination: `${apiOrigin}/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
