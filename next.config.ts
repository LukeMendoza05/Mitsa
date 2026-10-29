import type { NextConfig } from "next";

const config: NextConfig = {
  // The clean export must never resolve or trace its ancestor private checkout.
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  logging: { incomingRequests: { ignore: [/\/auth\/(email|confirm)/, /\/invitations\//] } },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};
export default config;
