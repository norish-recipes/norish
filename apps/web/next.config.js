import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import withSerwistInit from "@serwist/next";
import createNextIntlPlugin from "next-intl/plugin";

import { getNextIntlRequestConfigPath } from "./config/next-intl-request-config-path.js";

const configDirectory = dirname(fileURLToPath(import.meta.url));
const rootPackageJsonPath = resolve(configDirectory, "../../package.json");
const webPackageJsonPath = resolve(configDirectory, "./package.json");
const workspacePackagesDirectory = resolve(configDirectory, "../../packages");

function readPackageJson(packagePath, fallback) {
  if (!existsSync(packagePath)) {
    return fallback;
  }

  return JSON.parse(readFileSync(packagePath, "utf-8"));
}

function readRootVersionFromEnv() {
  try {
    const report = JSON.parse(process.env.NORISH_VERSION_REPORT_JSON ?? "{}");

    return typeof report.root === "string" ? report.root : "unavailable";
  } catch {
    return "unavailable";
  }
}

const packageJson = readPackageJson(rootPackageJsonPath, {
  version: readRootVersionFromEnv(),
});
const webPackageJson = readPackageJson(webPackageJsonPath, { name: "@norish/web" });
const workspacePackages = Array.from(
  new Set([
    webPackageJson.name,
    ...(existsSync(workspacePackagesDirectory)
      ? readdirSync(workspacePackagesDirectory, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => resolve(workspacePackagesDirectory, entry.name, "package.json"))
          .filter((packagePath) => existsSync(packagePath))
          .map((packagePath) => JSON.parse(readFileSync(packagePath, "utf-8")).name)
          .filter((packageName) => packageName.startsWith("@norish/"))
      : []),
  ])
);

const withNextIntl = createNextIntlPlugin(getNextIntlRequestConfigPath());

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  // The app owns its own connectivity runtime + Reconnect Sequence; Serwist must not
  // reload the page on the browser `online` event, which is only a hint here (ADR-0006).
  reloadOnOnline: false,
  // Registration stays with <RegisterServiceWorker/> (one explicit, logged /sw.js path)
  // rather than Serwist's injected window runtime.
  register: false,
  disable: process.env.NODE_ENV === "development",
  // Precache the offline navigation-fallback document so the SW's `fallbacks`
  // can serve it (ADR-0006). Appended via a manifest transform — passing
  // `additionalPrecacheEntries` instead would *replace* the default public/
  // folder scan. The revision is per-build: the page's HTML references
  // content-hashed chunks, so a stale copy would point at pruned assets.
  manifestTransforms: [
    async (entries) => ({
      manifest: [...entries, { url: "/~offline", revision: randomUUID(), size: 0 }],
      warnings: [],
    }),
  ],
});

export default withSerwist(
  withNextIntl({
    output: "standalone",
    transpilePackages: workspacePackages,
    turbopack: {
      root: resolve(configDirectory, "../.."),
    },
    productionBrowserSourceMaps: false,
    allowedDevOrigins: ["localhost", "192.168.2.13", "192.168.2.25", "http://mac-mini.local"],
    devIndicators: false,
    env: {
      NEXT_PUBLIC_APP_VERSION: packageJson.version,
    },
    serverExternalPackages: ["pino", "pino-pretty", "thread-stream", "playwright-core"],
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
  })
);
