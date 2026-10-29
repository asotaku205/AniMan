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
      {
        source: "/ai/:path*",
        destination: `${apiOrigin}/ai/:path*`,
      },
      {
        source: "/works",
        destination: `${apiOrigin}/works`,
      },
      {
        source: "/works/:path*",
        destination: `${apiOrigin}/works/:path*`,
      },
      {
        source: "/admin/:path*",
        destination: `${apiOrigin}/admin/:path*`,
      },
    ];
  },
};

export default nextConfig;
