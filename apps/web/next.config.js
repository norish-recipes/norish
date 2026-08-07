import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withSerwist } from "@serwist/turbopack";
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
          // @serwist/turbopack serves the worker from a Route Handler rather
          // than public/, so the path is /serwist/sw.js and the handler owns
          // Content-Type + Service-Worker-Allowed. Only the policy headers
          // stay here; re-declaring Content-Type would fight the handler.
          source: "/serwist/:path*",
          headers: [
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
