import fs from "node:fs";
import path from "node:path";

const WORKSPACE_ROOT_MARKER = "pnpm-workspace.yaml";

export function resolveExistingWorkspacePath(
  relativePath: string,
  startDir = process.cwd()
): string {
  let currentDir = startDir;

  while (true) {
    const candidate = path.join(currentDir, relativePath);

    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      throw new Error(`Unable to locate '${relativePath}' from '${startDir}'`);
    }

    currentDir = parentDir;
  }
}

export function resolveWorkspaceRoot(startDir = process.cwd()): string {
  return path.dirname(resolveExistingWorkspacePath(WORKSPACE_ROOT_MARKER, startDir));
}

export function resolveWorkspaceRootPath(relativePath: string, startDir = process.cwd()): string {
  return path.join(resolveWorkspaceRoot(startDir), relativePath);
}
