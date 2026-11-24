import withBundleAnalyzerPlugin from "@next/bundle-analyzer";
import type { NextConfig } from "next";

const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? withBundleAnalyzerPlugin({ enabled: true, openAnalyzer: false })
    : (config: NextConfig) => config;

const backendUrl =
  process.env.BACKEND_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

const rpcUrl =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
const horizonUrl =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://stellar.creit.tech https://gateway.pinata.cloud",
  `connect-src 'self' ${rpcUrl} ${horizonUrl} https://friendbot.stellar.org https://api.pinata.cloud https://gateway.pinata.cloud`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    // The multi-service vercel.json setup doesn't serve /_next/image (it 404s),
    // so serve files from /public directly instead of through the optimizer.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "stellar.creit.tech",
        pathname: "/wallet-icons/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
  // Local dev: proxy /api/* to NestJS (matches Vercel rewrites in production).
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  experimental: {
    optimizePackageImports: [
      "@iconify/react",
      "framer-motion",
      "lucide-react",
      "react-icons",
    ],
  },
};

export default withBundleAnalyzer(nextConfig);
