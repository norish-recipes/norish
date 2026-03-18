import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function getNextIntlRequestConfigPath() {
  const appRootPath = "./i18n/request.ts";

  if (existsSync(resolve(process.cwd(), appRootPath))) {
    return appRootPath;
  }

  const workspaceRootPath = "./apps/web/i18n/request.ts";

  if (existsSync(resolve(process.cwd(), workspaceRootPath))) {
    return workspaceRootPath;
  }

  return appRootPath;
}
