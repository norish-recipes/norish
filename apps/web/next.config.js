import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";

import { getNextIntlRequestConfigPath } from "./config/next-intl-request-config-path.js";

const configDirectory = dirname(fileURLToPath(import.meta.url));
const rootPackageJsonPath = resolve(configDirectory, "../../package.json");
const packageJson = JSON.parse(readFileSync(rootPackageJsonPath, "utf-8"));

const withNextIntl = createNextIntlPlugin(getNextIntlRequestConfigPath());

export default withNextIntl({
  output: "standalone",
  turbopack: {
    root: resolve(configDirectory, "../.."),
  },
  productionBrowserSourceMaps: false,
  allowedDevOrigins: ["localhost", "192.168.2.13"],
  devIndicators: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream", "playwright-core", "ws"],
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
