import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const mediaOrigin = new URL(process.env.INTERNAL_API_BASE_URL || "http://localhost:4000");
const extraImageOrigins = (process.env.IMAGE_ALLOWED_ORIGINS || "")
  .split(",").map((origin) => origin.trim()).filter(Boolean).map((origin) => new URL(origin));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  images: {
    // Keep optimizer on in dev so QA on localhost matches prod image behavior
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === "true",
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      ...[mediaOrigin, ...extraImageOrigins].map((origin) => ({
        protocol: origin.protocol.slice(0, -1),
        hostname: origin.hostname,
        port: origin.port,
        pathname: origin === mediaOrigin ? "/uploads/**" : "/**",
      })),
    ],
  },

  async headers() {
    // Long-lived asset caching is for production only — Next.js owns
    // Cache-Control for /_next/* in development.
    const securityHeaders = {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ],
    };
    if (process.env.NODE_ENV !== "production") return [securityHeaders];

    return [
      securityHeaders,
      {
        source: "/:path*\\.(avif|webp|jpg|jpeg|png|gif|svg|mp4|webm|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, must-revalidate",
          },
        ],
      },
    ];
  },

};

export default nextConfig;
