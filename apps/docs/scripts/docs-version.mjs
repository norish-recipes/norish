#!/usr/bin/env node
// Cut a docs release.
//
//   pnpm docs_update            # interactive: asks for the next version
//   pnpm docs_update 0.20.0     # non-interactive: pass the next version
//
// It freezes the current (editable) docs under their current version label,
// then bumps `versions.current.label` in docusaurus.config.ts to the next
// version so docs/ becomes the new in-development version. The frozen version
// stays browsable from the navbar version dropdown.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(projectRoot, "docusaurus.config.ts");
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
const currentVersion = match[1];

async function resolveNextVersion() {
  const fromArg = process.argv[2]?.trim();
  if (fromArg) return fromArg;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `Current docs version is ${currentVersion}. Next development version? `
  );
  rl.close();
  return answer.trim();
}

const nextVersion = await resolveNextVersion();

if (!nextVersion) {
  console.error("No next version provided. Aborting.");
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+/.test(nextVersion)) {
  console.error(`"${nextVersion}" does not look like a version (e.g. 0.20.0). Aborting.`);
  process.exit(1);
}
if (nextVersion === currentVersion) {
  console.error(`Next version must differ from the current one (${currentVersion}). Aborting.`);
  process.exit(1);
}

console.log(`\nFreezing the current docs as ${currentVersion}…`);
execSync(`pnpm exec docusaurus docs:version ${currentVersion}`, {
  cwd: projectRoot,
  stdio: "inherit",
});

console.log(`Bumping the editable docs label ${currentVersion} → ${nextVersion}…`);
writeFileSync(configPath, config.replace(labelRe, `current: { label: "${nextVersion}" }`));

console.log(
  `\n✅ Froze ${currentVersion} and moved the editable docs to ${nextVersion}.` +
    `\n   • ${currentVersion} is now in versioned_docs/ and on the version dropdown.` +
    `\n   • Keep editing docs/ for ${nextVersion}.` +
    `\n   Run \`pnpm build\` to verify.`
);
