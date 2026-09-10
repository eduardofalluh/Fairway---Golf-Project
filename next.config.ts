import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/:path((?!_next/static|_next/image|icon.svg|hero.jpg|golf.jpg|golf2.jpg|golf3.jpg|golf-hero-video.mp4).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
