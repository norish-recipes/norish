import { readFile } from "node:fs/promises";

export * from "./logger";
import { resolveWorkspaceRootPath } from "./lib/workspace-paths";

type PackageVersionManifest = {
  version: string;
};

export type AppVersions = {
  app: string;
  web: string;
  mobile: string;
};

async function readPackageVersion(relativePath: string, fallbackVersion?: string) {
  try {
    const packageJsonPath = resolveWorkspaceRootPath(relativePath);
    const packageJson = await readFile(packageJsonPath, "utf8");

    return (JSON.parse(packageJson) as PackageVersionManifest).version;
  } catch (error) {
    if (fallbackVersion !== undefined) {
      return fallbackVersion;
    }

    throw error;
  }
}

let appVersionsPromise: Promise<AppVersions> | undefined;

export function getAppVersions() {
  appVersionsPromise ??= Promise.all([
    readPackageVersion("package.json"),
    readPackageVersion("apps/web/package.json"),
    readPackageVersion("apps/mobile/package.json", "unavailable"),
  ]).then(([appVersion, webVersion, mobileVersion]) => {
    return {
      app: appVersion,
      web: webVersion,
      mobile: mobileVersion,
    } satisfies AppVersions;
  });

  return appVersionsPromise;
}
