#!/usr/bin/env node
/**
 * Keep the release version in step with the rc branch.
 *
 * An rc branch is named after the release it builds (`rc/0.24.0-beta`), and
 * the RC pipeline tags and publishes whatever the root package.json says. When
 * the two disagree, the pipeline publishes the new release's code under the
 * previous release's tag. This script makes the branch name the source of
 * truth:
 *
 *   node tooling/monorepo/scripts/sync-version.mjs            # version from the current rc/ branch
 *   node tooling/monorepo/scripts/sync-version.mjs 0.25.0-beta
 *   node tooling/monorepo/scripts/sync-version.mjs --check    # exit 1 on any mismatch, write nothing
 *
 * `--check` also reads the branch from GITHUB_REF_NAME, so CI can run it on a
 * detached checkout.
 *
 * Every workspace package moves in lockstep with the root, except the ones in
 * INDEPENDENT, which carry versions of their own.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

/** Versioned on their own cadence: the parked mobile app and the marketing site. */
const INDEPENDENT = new Set(["apps/mobile", "apps/landing"]);

const RC_BRANCH = /^rc\/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function currentBranch() {
  if (process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME;

  return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

function readWorkspaceGlobs() {
  const lines = readFileSync(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8").split(/\r?\n/);
  const globs = [];
  let inPackages = false;

  for (const line of lines) {
    if (/^\S/.test(line)) {
      inPackages = line.trim() === "packages:";
      continue;
    }

    const match = inPackages && line.match(/^\s*-\s+["']?([^"']+)["']?\s*$/);

    if (match) globs.push(match[1]);
  }

  return globs;
}

/** The root plus every versioned workspace package that is not INDEPENDENT. */
function lockstepManifests() {
  const globs = readWorkspaceGlobs();
  const excluded = new Set(
    globs.filter((glob) => glob.startsWith("!")).map((glob) => glob.slice(1))
  );
  const dirs = globs
    .filter((glob) => !glob.startsWith("!"))
    .flatMap((glob) => {
      if (!glob.endsWith("/*")) return [glob];

      const parent = glob.slice(0, -2);

      return readdirSync(path.join(repoRoot, parent), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${parent}/${entry.name}`);
    })
    .filter((dir) => !excluded.has(dir) && !INDEPENDENT.has(dir));

  return ["package.json", ...dirs.map((dir) => `${dir}/package.json`)]
    .filter((file) => existsSync(path.join(repoRoot, file)))
    .filter((file) => "version" in JSON.parse(readFileSync(path.join(repoRoot, file), "utf8")));
}

function resolveTarget(arg) {
  if (arg) {
    if (!VERSION.test(arg)) throw new Error(`"${arg}" is not a version like 0.24.0-beta`);

    return arg;
  }

  const branch = currentBranch();
  const match = branch.match(RC_BRANCH);

  if (!match) {
    throw new Error(`"${branch}" is not an rc/<version> branch; pass the version explicitly`);
  }

  return match[1];
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const target = resolveTarget(args.find((arg) => !arg.startsWith("--")));
  const stale = [];

  for (const file of lockstepManifests()) {
    const absolute = path.join(repoRoot, file);
    const source = readFileSync(absolute, "utf8");
    const { version } = JSON.parse(source);

    if (version === target) continue;

    stale.push(`${file}: ${version}`);

    // A targeted replace rather than a JSON round trip, so key order and
    // formatting stay exactly as Prettier left them.
    if (!check) {
      writeFileSync(absolute, source.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${target}"`));
    }
  }

  if (stale.length === 0) {
    console.log(`Every lockstep package is at ${target}.`);

    return;
  }

  if (check) {
    console.error(`These packages are not at ${target}:\n  ${stale.join("\n  ")}`);
    console.error("Run `pnpm version:sync` on the rc branch and commit the result.");
    process.exit(1);
  }

  console.log(`Moved to ${target}:\n  ${stale.join("\n  ")}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
