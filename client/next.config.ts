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
      // API admin PHẢI đi qua /api (không dùng thẳng /admin): rewrites
      // dạng mảng chạy SAU khi kiểm tra filesystem, mà /admin/users hay
      // /admin/settings đều có trang trùng đường dẫn nên fetch sẽ nhận
      // HTML của trang thay vì JSON từ server API. /api không có trang
      // nào trùng nên rewrite luôn trúng.
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/:path*`,
      },
      {
        source: "/site/status",
        destination: `${apiOrigin}/site/status`,
      },
    ];
  },
};

export default nextConfig;
