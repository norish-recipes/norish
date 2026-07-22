#!/usr/bin/env node
// Cut (or verify) the docs release checkpoint — the supported version command
// of ADR-0010.
//
//   pnpm docs_update              # interactive: asks for the target version
//   pnpm docs_update 0.20.0-beta  # non-interactive: pass the current release
//
// Given the current release identifier, the command reconciles the editable
// docs with it:
//   • label behind the release  → freeze the outgoing label once under
//     versioned_docs/ and advance `versions.current.label` to the release;
//   • label equals the release  → nothing to do (safe rerun), provided the
//     snapshot state is coherent;
//   • label ahead / contradictory snapshots (the release already frozen, or
//     the outgoing label frozen twice) → stop with an error rather than
//     guessing over generated version metadata.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(
  process.env.DOCS_PROJECT_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..")
);
const configPath = resolve(projectRoot, "docusaurus.config.ts");
const versionsPath = resolve(projectRoot, "versions.json");
const config = readFileSync(configPath, "utf8");

// versions: { current: { label: "X" } }
const labelRe = /current:\s*\{\s*label:\s*"([^"]+)"\s*\}/;
const match = config.match(labelRe);
if (!match) {
  console.error(
    'Could not find `versions: { current: { label: "..." } }` in docusaurus.config.ts.'
  );
  process.exit(1);
}
const currentLabel = match[1];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseVersion(value) {
  const parsed = /^(\d+)\.(\d+)\.(\d+)/.exec(value);
  if (!parsed) return null;
  return [Number(parsed[1]), Number(parsed[2]), Number(parsed[3])];
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function readFrozenVersions() {
  if (!existsSync(versionsPath)) return [];
  return JSON.parse(readFileSync(versionsPath, "utf8"));
}

async function resolveTargetVersion() {
  const fromArg = process.argv[2]?.trim();
  if (fromArg) return fromArg;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `Editable docs label is ${currentLabel}. Current release to checkpoint? `
  );
  rl.close();
  return answer.trim();
}

const target = await resolveTargetVersion();

if (!target) {
  fail("No version provided. Aborting.");
}
const targetParsed = parseVersion(target);
if (!targetParsed) {
  fail(`"${target}" does not look like a version (e.g. 0.20.0-beta). Aborting.`);
}
const labelParsed = parseVersion(currentLabel);
if (!labelParsed) {
  fail(`The editable docs label "${currentLabel}" is not a version. Fix docusaurus.config.ts.`);
}

const frozen = readFrozenVersions();
const order = compareVersions(labelParsed, targetParsed);

if (order > 0) {
  fail(
    `The editable docs label ${currentLabel} is ahead of ${target}. Refusing to guess over a ` +
      `newer docs version — resolve the drift by hand.`
  );
}

// From here the label is at or behind the release, so a frozen snapshot of
// the release itself can only mean broken version metadata.
if (frozen.includes(target)) {
  fail(
    `Contradictory state: ${target} is already frozen in versions.json while the editable ` +
      `label is ${currentLabel}. Resolve the snapshots by hand before rerunning.`
  );
}

if (order === 0) {
  console.log(
    `Docs checkpoint already current: the editable label is ${currentLabel}. Nothing to do.`
  );
  process.exit(0);
}

if (frozen.includes(currentLabel)) {
  fail(
    `Contradictory state: the outgoing label ${currentLabel} is already frozen in ` +
      `versions.json. A checkpoint must be cut exactly once — resolve the snapshots by hand.`
  );
}

console.log(`\nFreezing the current docs as ${currentLabel}…`);
// DOCS_FREEZE_COMMAND is the fixture seam for tests; the real command is
// Docusaurus's own versioning, the only supported way to create a snapshot.
const freezeCommand =
  process.env.DOCS_FREEZE_COMMAND ?? `pnpm exec docusaurus docs:version ${currentLabel}`;
execSync(freezeCommand, {
  cwd: projectRoot,
  stdio: "inherit",
  env: { ...process.env, DOCS_FREEZE_VERSION: currentLabel },
});

console.log(`Bumping the editable docs label ${currentLabel} → ${target}…`);
writeFileSync(configPath, config.replace(labelRe, `current: { label: "${target}" }`));

console.log(
  `\n✅ Froze ${currentLabel} and moved the editable docs to ${target}.` +
    `\n   • ${currentLabel} is now in versioned_docs/ and on the version dropdown.` +
    `\n   • Keep editing docs/ for ${target}.` +
    `\n   Run \`pnpm build\` to verify.`
);
