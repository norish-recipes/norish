#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

function readWorkspacePackagePatterns() {
  const workspaceFile = readFileSync(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8");
  const lines = workspaceFile.split(/\r?\n/);
  const patterns = [];
  let inPackages = false;

  for (const line of lines) {
    if (/^\S/.test(line)) {
      inPackages = line.trim() === "packages:";
      continue;
    }

    if (!inPackages) {
      continue;
    }

    const match = line.match(/^\s*-\s+["']?([^"']+)["']?\s*$/);

    if (match) {
      patterns.push(match[1]);
    }
  }

  return patterns;
}

function readManifest(relativePath) {
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8"));

  return {
    name: manifest.name,
    version: manifest.version,
  };
}

function packageKey(name) {
  return name.startsWith("@norish/") ? name.slice("@norish/".length) : name;
}

function isExcludedWorkspace(relativePath, excludePatterns) {
  return excludePatterns.includes(`!${relativePath}`);
}

function readWorkspaceVersions(workspaceDir, excludePatterns) {
  return Object.fromEntries(
    readdirSync(path.join(repoRoot, workspaceDir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(workspaceDir, entry.name))
      .filter((relativePath) => !isExcludedWorkspace(relativePath, excludePatterns))
      .map((relativePath) => path.join(relativePath, "package.json"))
      .filter((relativePath) => existsSync(path.join(repoRoot, relativePath)))
      .map((relativePath) => readManifest(relativePath))
      .sort((left, right) => packageKey(left.name).localeCompare(packageKey(right.name)))
      .map((manifest) => [packageKey(manifest.name), manifest.version])
  );
}

const root = readManifest("package.json");
const workspacePackagePatterns = readWorkspacePackagePatterns();
const excludePatterns = workspacePackagePatterns.filter((pattern) => pattern.startsWith("!"));

console.log(
  JSON.stringify({
    root: root.version,
    apps: readWorkspaceVersions("apps", excludePatterns),
    packages: readWorkspaceVersions("packages", excludePatterns),
  })
);
