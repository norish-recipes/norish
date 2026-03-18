import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_TARGETS = [
  "apps/web",
  "apps/mobile",
  "packages/api",
  "packages/auth",
  "packages/config",
  "packages/db",
  "packages/i18n",
  "packages/queue",
  "packages/shared",
  "packages/shared-react",
  "packages/shared-server",
  "packages/trpc",
  "packages/ui",
];

export function resolveExistingTargets(rootDir, candidates = DEFAULT_TARGETS) {
  return candidates.filter((target) => existsSync(resolve(rootDir, target)));
}

export function buildMadgeArgs(targets) {
  return [
    "dlx",
    "madge",
    "--circular",
    "--json",
    "--extensions",
    "ts,tsx",
    "--exclude",
    "dist/",
    "--ts-config",
    "tooling/typescript/base.json",
    ...targets,
  ];
}

export function runCycleCheck({ cwd = process.cwd(), logger = console } = {}) {
  const targets = resolveExistingTargets(cwd);

  if (targets.length === 0) {
    logger.error("No valid source directories were found for cycle checking.");
    return 1;
  }

  const result = spawnSync("pnpm", buildMadgeArgs(targets), {
    cwd,
    encoding: "utf8",
  });

  if (result.error) {
    logger.error("Failed to run madge:", result.error.message);
    return 1;
  }

  let cycles;

  try {
    cycles = JSON.parse(result.stdout || "[]");
  } catch {
    logger.error("Failed to parse madge output as JSON.");
    if (result.stdout) {
      logger.error(result.stdout);
    }
    if (result.stderr) {
      logger.error(result.stderr);
    }
    return 1;
  }

  if (!Array.isArray(cycles)) {
    logger.error("Unexpected madge output shape.");
    return 1;
  }

  if (cycles.length > 0) {
    logger.error(`Found ${cycles.length} circular dependenc${cycles.length === 1 ? "y" : "ies"}.`);
    for (const cycle of cycles) {
      if (Array.isArray(cycle)) {
        logger.error(`- ${cycle.join(" -> ")}`);
      }
    }
    return 1;
  }

  if (result.status !== 0) {
    if (result.stderr) {
      logger.error(result.stderr);
    }
    return result.status ?? 1;
  }

  logger.log("No circular dependencies found.");
  return 0;
}

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath === scriptPath) {
  process.exit(runCycleCheck());
}
