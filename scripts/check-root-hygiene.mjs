import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const policyPath = path.join(rootDir, "tooling/monorepo/root-hygiene-policy.json");
const packageJsonPath = path.join(rootDir, "package.json");
const npmrcPath = path.join(rootDir, ".npmrc");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hasMetadata(entry) {
  return Boolean(entry && entry.owner && entry.rationale && entry.removeBy);
}

const policy = readJson(policyPath);
const pkg = readJson(packageJsonPath);
const errors = [];

const rootDependencies = Object.keys(pkg.dependencies ?? {});
const rootDevDependencies = Object.keys(pkg.devDependencies ?? {});

const allowedRootDeps = new Set(policy.allowedRootDependencies ?? []);
const allowedRootDevDeps = new Set(policy.allowedRootDevDependencies ?? []);

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

const exceptionMap = new Map((policy.dependencyExceptions ?? []).map((entry) => [entry.name, entry]));

for (const dependency of rootDevDependencies) {
  if (!exceptionMap.has(dependency)) {
    continue;
  }

  if (!hasMetadata(exceptionMap.get(dependency))) {
    errors.push(`Dependency exception missing metadata: ${dependency}`);
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

const rootFiles = fs
  .readdirSync(rootDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);

const isRootConfigFile = (fileName) => {
  if (fileName === ".npmrc") {
    return true;
  }

  if (fileName === "pnpm-workspace.yaml" || fileName === "package.json" || fileName === "turbo.json") {
    return true;
  }

  if (fileName === "next-env.d.ts") {
    return true;
  }

  if (fileName.startsWith("tsconfig") && fileName.endsWith(".json")) {
    return true;
  }

  return fileName.endsWith(".config.js") || fileName.endsWith(".config.mjs") || fileName.endsWith(".config.ts");
};

const allowlistedConfigFiles = new Set(policy.rootConfigAllowlist ?? []);

for (const fileName of rootFiles) {
  if (!isRootConfigFile(fileName)) {
    continue;
  }

  if (!allowlistedConfigFiles.has(fileName)) {
    errors.push(`Root config file not allowlisted: ${fileName}`);
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
