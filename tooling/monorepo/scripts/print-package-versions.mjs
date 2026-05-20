#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

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

function readWorkspaceVersions(workspaceDir) {
  return Object.fromEntries(
    readdirSync(path.join(repoRoot, workspaceDir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => readManifest(path.join(workspaceDir, entry.name, "package.json")))
      .sort((left, right) => packageKey(left.name).localeCompare(packageKey(right.name)))
      .map((manifest) => [packageKey(manifest.name), manifest.version])
  );
}

const root = readManifest("package.json");

console.log(
  JSON.stringify({
    root: root.version,
    apps: readWorkspaceVersions("apps"),
    packages: readWorkspaceVersions("packages"),
  })
);
