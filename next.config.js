import createNextIntlPlugin from "next-intl/plugin";
import { readFileSync } from "fs";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));

const withNextIntl = createNextIntlPlugin("./apps/web/i18n/request.ts");

export default withNextIntl({
  output: "standalone",
  productionBrowserSourceMaps: false,
  allowedDevOrigins: ["localhost", "192.168.2.13"],
  devIndicators: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  serverExternalPackages: [
    "pino",
    "pino-pretty",
    "thread-stream",
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
});
