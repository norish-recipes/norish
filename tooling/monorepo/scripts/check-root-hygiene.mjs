import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "../../..");
const policyPath = path.join(rootDir, "tooling/monorepo/root-hygiene-policy.json");
const packageJsonPath = path.join(rootDir, "package.json");
const npmrcPath = path.join(rootDir, ".npmrc");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hasMetadata(entry) {
  return Boolean(entry && entry.owner && entry.rationale && entry.removeBy);
}

function isGitIgnored(entryName) {
  const result = spawnSync("git", ["check-ignore", "--quiet", entryName], {
    cwd: rootDir,
    stdio: "ignore",
  });

  return result.status === 0;
}

const policy = readJson(policyPath);
const pkg = readJson(packageJsonPath);
const errors = [];

const rootDependencies = Object.keys(pkg.dependencies ?? {});
const rootDevDependencies = Object.keys(pkg.devDependencies ?? {});
const rootManifestDependencySet = new Set([...rootDependencies, ...rootDevDependencies]);

const allowedRootDeps = new Set(policy.allowedRootDependencies ?? []);
const allowedRootDevDeps = new Set(policy.allowedRootDevDependencies ?? []);
const allowedRootFiles = new Set(policy.allowedRootFiles ?? []);
const allowedRootDirectories = new Set(policy.allowedRootDirectories ?? []);
const requiredToolingWorkspacePackages = policy.requiredToolingWorkspacePackages ?? [];

for (const dependency of rootDependencies) {
  if (!allowedRootDeps.has(dependency)) {
    errors.push(`Unexpected root dependency: ${dependency}`);
  }
}

for (const dependency of rootDevDependencies) {
  if (!allowedRootDevDeps.has(dependency)) {
    errors.push(`Unexpected root devDependency: ${dependency}`);
  }
}

for (const entry of policy.dependencyExceptions ?? []) {
  if (!hasMetadata(entry)) {
    errors.push(`Dependency exception missing metadata: ${entry.name}`);
  }

  if (!rootManifestDependencySet.has(entry.name)) {
    errors.push(`Dependency exception has no root manifest entry: ${entry.name}`);
  }
}

for (const packagePath of requiredToolingWorkspacePackages) {
  const fullPath = path.join(rootDir, packagePath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Required tooling workspace package is missing: ${packagePath}`);
  }
}

for (const shim of policy.temporaryShims ?? []) {
  const shimPath = path.join(rootDir, shim.path);

  if (!fs.existsSync(shimPath)) {
    errors.push(`Temporary shim is missing: ${shim.path}`);
    continue;
  }

  if (!hasMetadata(shim)) {
    errors.push(`Temporary shim missing metadata: ${shim.path}`);
  }
}

for (const forbiddenPath of policy.forbiddenRootFiles ?? []) {
  if (fs.existsSync(path.join(rootDir, forbiddenPath))) {
    errors.push(`Forbidden root file present: ${forbiddenPath}`);
  }
}

for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
  if (entry.name === ".git") {
    continue;
  }

  if (isGitIgnored(entry.name)) {
    continue;
  }

  if (entry.isFile() && !allowedRootFiles.has(entry.name)) {
    errors.push(`Root file not allowlisted: ${entry.name}`);
    continue;
  }

  if (entry.isDirectory() && !allowedRootDirectories.has(entry.name)) {
    errors.push(`Root directory not allowlisted: ${entry.name}`);
  }
}

const npmrcLines = fs
  .readFileSync(npmrcPath, "utf8")
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"));

for (const disallowedSetting of policy.disallowedNpmrcSettings ?? []) {
  if (npmrcLines.includes(disallowedSetting)) {
    errors.push(`Disallowed .npmrc setting found: ${disallowedSetting}`);
  }
}

if (!npmrcLines.includes("hoist=false")) {
  errors.push("Missing required .npmrc setting: hoist=false");
}

if (!npmrcLines.includes("strict-peer-dependencies=true")) {
  errors.push("Missing required .npmrc setting: strict-peer-dependencies=true");
}

if (errors.length > 0) {
  console.error("Root hygiene check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log("Root hygiene check passed.");
