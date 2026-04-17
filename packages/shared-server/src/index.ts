import { readFile } from "node:fs/promises";

import { resolveExistingWorkspacePath } from "./lib/workspace-paths";

export * from "./logger";

type PackageVersionManifest = {
  version: string;
};

export type AppVersions = {
  app: string;
  web: string;
  mobile: string;
};

const appVersionsPromise = Promise.all([
  readFile(resolveExistingWorkspacePath("package.json"), "utf8"),
  readFile(resolveExistingWorkspacePath("apps/web/package.json"), "utf8"),
  readFile(resolveExistingWorkspacePath("apps/mobile/package.json"), "utf8"),
]).then(([appPackageJson, webPackageJson, mobilePackageJson]) => {
  const appPackage = JSON.parse(appPackageJson) as PackageVersionManifest;
  const webPackage = JSON.parse(webPackageJson) as PackageVersionManifest;
  const mobilePackage = JSON.parse(mobilePackageJson) as PackageVersionManifest;

  return {
    app: appPackage.version,
    web: webPackage.version,
    mobile: mobilePackage.version,
  } satisfies AppVersions;
});

export function getAppVersions() {
  return appVersionsPromise;
}
