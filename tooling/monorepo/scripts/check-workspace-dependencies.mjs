import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "../../..");

const builtins = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => name.replace(/^node:/u, "")),
]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

const importPattern =
  /\b(?:import|export)\s+(?:[^"\n]*?from\s+)?["']([^"']+)["']|\brequire\(\s*["']([^"']+)["']\s*\)|\bimport\(\s*["']([^"']+)["']\s*\)/gu;

function listWorkspaceDirs(baseDirName) {
  const baseDir = path.join(rootDir, baseDirName);

  if (!fs.existsSync(baseDir) || !fs.statSync(baseDir).isDirectory()) {
    return [];
  }

  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(baseDir, entry.name))
    .filter((workspaceDir) => fs.existsSync(path.join(workspaceDir, "package.json")));
}

function collectSourceFiles(dirPath, files = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name === "dist" ||
      entry.name === "coverage" ||
      entry.name === ".turbo" ||
      entry.name === ".git"
    ) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, files);
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizeDependencyName(specifier) {
  if (!specifier) {
    return null;
  }

  if (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/") ||
    specifier.startsWith("@/") ||
    specifier.startsWith("~/")
  ) {
    return null;
  }

  if (specifier.startsWith("node:")) {
    return null;
  }

  if (/^[a-zA-Z]+:/u.test(specifier)) {
    return null;
  }

  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");

    if (!scope || !name) {
      return null;
    }

    return `${scope}/${name}`;
  }

  return specifier.split("/")[0];
}

function isDevFile(filePath) {
  return (
    /\.(test|spec)\.[jt]sx?$/u.test(filePath) ||
    filePath.includes("__tests__") ||
    filePath.includes("/tests/")
  );
}

function getDeclaredDependencies(packageJson) {
  return new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
  ]);
}

const workspaceDirs = [
  ...listWorkspaceDirs("apps"),
  ...listWorkspaceDirs("packages"),
  ...listWorkspaceDirs("tooling"),
];

const failures = [];

for (const workspaceDir of workspaceDirs) {
  const packageJsonPath = path.join(workspaceDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const workspaceName = packageJson.name;
  const declaredDependencies = getDeclaredDependencies(packageJson);
  const missingDependencies = new Map();
  const sourceFiles = collectSourceFiles(workspaceDir);

  for (const filePath of sourceFiles) {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const relativeFilePath = path.relative(rootDir, filePath);
    const devFile = isDevFile(relativeFilePath);
    for (const match of fileContent.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2] ?? match[3] ?? null;
      const dependencyName = normalizeDependencyName(specifier);

      if (!dependencyName) {
        continue;
      }

      if (builtins.has(dependencyName)) {
        continue;
      }

      if (workspaceName && dependencyName === workspaceName) {
        continue;
      }

      if (declaredDependencies.has(dependencyName)) {
        continue;
      }

      const current = missingDependencies.get(dependencyName) ?? {
        devFiles: new Set(),
        prodFiles: new Set(),
      };

      if (devFile) {
        current.devFiles.add(relativeFilePath);
      } else {
        current.prodFiles.add(relativeFilePath);
      }

      missingDependencies.set(dependencyName, current);
    }
  }

  if (missingDependencies.size === 0) {
    continue;
  }

  const missing = [];

  for (const [dependencyName, usage] of [...missingDependencies.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const sampleFile =
      usage.prodFiles.values().next().value ?? usage.devFiles.values().next().value;
    const targetSection = usage.prodFiles.size > 0 ? "dependencies" : "devDependencies";
    missing.push({
      dependencyName,
      sampleFile,
      targetSection,
    });
  }

  failures.push({
    workspaceDir: path.relative(rootDir, workspaceDir),
    workspaceName,
    missing,
  });
}

if (failures.length > 0) {
  console.error("Workspace dependency declaration check failed:");

  for (const failure of failures) {
    console.error(`\n- ${failure.workspaceName} (${failure.workspaceDir})`);

    for (const item of failure.missing) {
      console.error(
        `  - ${item.dependencyName} (used in ${item.sampleFile}; add to ${item.targetSection})`
      );
    }
  }

  process.exit(1);
}

console.log("Workspace dependency declaration check passed.");
