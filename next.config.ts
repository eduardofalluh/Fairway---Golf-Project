import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Brand media rarely changes; let browsers and the CDN keep it.
        source: "/:file(hero\\.mp4|hero\\.jpg|cta\\.jpg|icon\\.svg)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
};

export default nextConfig;
