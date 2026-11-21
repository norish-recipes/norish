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
  "packages/db-schema",
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

// Run inside the workspace with its own tsconfig: madge resolves `paths` such as `@/*` against
// the working directory, so a shared tsconfig left every alias import out of the graph.
export function buildMadgeArgs() {
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
    "tsconfig.json",
    ".",
  ];
}

/** The cycles madge finds in one workspace, each file prefixed with the workspace; null on failure. */
function findCycles(rootDir, target, logger) {
  const result = spawnSync("pnpm", buildMadgeArgs(), {
    cwd: resolve(rootDir, target),
    encoding: "utf8",
  });

  if (result.error) {
    logger.error(`Failed to run madge in ${target}:`, result.error.message);
    return null;
  }

  let cycles;

  try {
    cycles = JSON.parse(result.stdout || "[]");
  } catch {
    logger.error(`Failed to parse madge output for ${target} as JSON.`);
    if (result.stdout) {
      logger.error(result.stdout);
    }
    if (result.stderr) {
      logger.error(result.stderr);
    }
    return null;
  }

  if (!Array.isArray(cycles)) {
    logger.error(`Unexpected madge output shape for ${target}.`);
    return null;
  }

  if (cycles.length === 0 && result.status !== 0) {
    if (result.stderr) {
      logger.error(result.stderr);
    }
    return null;
  }

  return cycles.map((cycle) => cycle.map((file) => `${target}/${file}`));
}

export function runCycleCheck({ cwd = process.cwd(), logger = console } = {}) {
  const targets = resolveExistingTargets(cwd);

  if (targets.length === 0) {
    logger.error("No valid source directories were found for cycle checking.");
    return 1;
  }

  const cycles = [];

  for (const target of targets) {
    const found = findCycles(cwd, target, logger);

    if (found === null) return 1;
    cycles.push(...found);
  }

  if (cycles.length > 0) {
    logger.error(`Found ${cycles.length} circular dependenc${cycles.length === 1 ? "y" : "ies"}.`);
    for (const cycle of cycles) {
      logger.error(`- ${cycle.join(" -> ")}`);
    }
    return 1;
  }

  logger.log("No circular dependencies found.");
  return 0;
}

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath === scriptPath) {
  process.exit(runCycleCheck());
}
