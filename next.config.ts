import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  serverExternalPackages: ["playwright-core"],
  outputFileTracingIncludes: {
    "/api/ingest": ["./node_modules/playwright-core/**/*"],
    "/api/simulation": ["./node_modules/playwright-core/**/*"],
  },
};

export default nextConfig;
