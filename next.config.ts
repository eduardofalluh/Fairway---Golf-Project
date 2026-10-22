import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy. Next.js inlines its bootstrap scripts on this
 * prerendered page, so scripts need 'unsafe-inline' (nonces would force every
 * request to render dynamically). Everything else is locked to this origin,
 * plus Chronogolf's photo CDN, OpenStreetMap tiles for the map, and
 * Chronogolf's official booking widget as the only allowed frame.
 */
export function contentSecurityPolicy(isDev = dev) {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.chronogolf.com https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "media-src 'self'",
    "frame-src https://www.chronogolf.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function securityHeaders(isDev = dev) {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), payment=(), usb=(), browsing-topics=(), geolocation=(self)",
    },
  ];
}

const nextConfig: NextConfig = {
  // Don't advertise the framework in every response.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders() },
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
