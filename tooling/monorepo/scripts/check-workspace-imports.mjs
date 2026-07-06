import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOTS = ["apps", "packages", "tooling"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const IGNORED_DIRS = new Set([
  ".cache",
  ".git",
  ".next",
  ".turbo",
  "build",
  "dist",
  "dist-server",
  "node_modules",
]);

const FORBIDDEN_EDGES = new Map([
  ["@norish/auth", new Set(["@norish/trpc", "@norish/queue"])],
  ["@norish/config", new Set(["@norish/db", "@norish/auth", "@norish/queue", "@norish/trpc"])],
  ["@norish/db", new Set(["@norish/auth", "@norish/queue", "@norish/trpc"])],
  ["@norish/db-schema", new Set(["@norish/db", "@norish/auth", "@norish/queue", "@norish/trpc"])],
  ["@norish/queue", new Set(["@norish/trpc"])],
  ["@norish/shared", new Set(["@norish/auth", "@norish/db", "@norish/queue", "@norish/trpc"])],
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function listPackageDirs(rootDir) {
  const dirs = [];

  for (const root of DEFAULT_ROOTS) {
    const absoluteRoot = join(rootDir, root);

    if (!existsSync(absoluteRoot)) continue;

    for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
      const candidate = join(absoluteRoot, entry.name);

      if (entry.isDirectory() && existsSync(join(candidate, "package.json"))) {
        dirs.push(candidate);
      }
    }
  }

  return dirs;
}

function packageNameFromImport(specifier) {
  const match = specifier.match(/^(@norish\/[^/"']+)/);

  return match?.[1] ?? null;
}

function declaredWorkspaceDeps(manifest) {
  return new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);
}

function walkSourceFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      walkSourceFiles(path, files);
      continue;
    }

    const dotIndex = entry.name.lastIndexOf(".");
    const extension = dotIndex >= 0 ? entry.name.slice(dotIndex) : "";

    if (SOURCE_EXTENSIONS.has(extension)) {
      files.push(path);
    }
  }

  return files;
}

function collectImports(file) {
  const source = readFileSync(file, "utf8");
  const imports = new Set();
  const importPattern =
    /(?:import\s+(?:type\s+)?[\s\S]*?\s+from\s+["']|export\s+(?:type\s+)?[\s\S]*?\s+from\s+["']|import\s*\(\s*["'])(@norish\/[^"']+)/g;

  for (const match of source.matchAll(importPattern)) {
    const packageName = packageNameFromImport(match[1]);

    if (packageName) imports.add(packageName);
  }

  return imports;
}

function checkPackage(rootDir, packageDir, workspacePackages) {
  const manifestPath = join(packageDir, "package.json");
  const manifest = readJson(manifestPath);
  const packageName = manifest.name;
  const declaredDeps = declaredWorkspaceDeps(manifest);
  const forbiddenDeps = FORBIDDEN_EDGES.get(packageName) ?? new Set();
  const issues = [];
  const sourceRoot = join(packageDir, "src");
  const searchRoot = existsSync(sourceRoot) ? sourceRoot : packageDir;

  for (const file of walkSourceFiles(searchRoot)) {
    for (const importedPackage of collectImports(file)) {
      if (importedPackage === packageName) continue;
      if (!workspacePackages.has(importedPackage)) continue;

      const location = relative(rootDir, file);

      if (!declaredDeps.has(importedPackage)) {
        issues.push(`${location}: imports undeclared workspace package ${importedPackage}`);
      }

      if (forbiddenDeps.has(importedPackage)) {
        issues.push(`${location}: forbidden dependency ${packageName} -> ${importedPackage}`);
      }
    }
  }

  return issues;
}

export function runWorkspaceImportCheck({ cwd = process.cwd(), logger = console } = {}) {
  const rootDir = resolve(cwd);
  const packageDirs = listPackageDirs(rootDir).filter((dir) => statSync(dir).isDirectory());
  const workspacePackages = new Set(
    packageDirs.map((dir) => readJson(join(dir, "package.json")).name)
  );
  const issues = packageDirs.flatMap((dir) => checkPackage(rootDir, dir, workspacePackages));

  if (issues.length > 0) {
    logger.error(`Found ${issues.length} workspace import issue${issues.length === 1 ? "" : "s"}.`);
    for (const issue of issues) {
      logger.error(`- ${issue}`);
    }

    return 1;
  }

  logger.log("No workspace import issues found.");
  return 0;
}

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath === scriptPath) {
  process.exit(runWorkspaceImportCheck());
}
