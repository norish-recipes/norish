// Fixture tests for the docs release checkpoint command (ADR-0010): the three
// version states — missing checkpoint, already-current checkpoint, invalid
// forward drift — plus the contradictory-snapshot stops. Assertions read the
// externally visible label and snapshot directories, not script internals.
//
//   node --test scripts/
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./docs-version.mjs");

// The fixture freeze command mirrors Docusaurus's externally visible effect:
// a versioned_docs snapshot directory plus a prepended versions.json entry.
const FREEZE_FIXTURE = `node -e "
  const fs = require('node:fs');
  const version = process.env.DOCS_FREEZE_VERSION;
  fs.mkdirSync('versioned_docs/version-' + version, { recursive: true });
  const versions = fs.existsSync('versions.json')
    ? JSON.parse(fs.readFileSync('versions.json', 'utf8'))
    : [];
  fs.writeFileSync('versions.json', JSON.stringify([version, ...versions]));
"`;

function makeFixture({ label, frozen }) {
  const root = mkdtempSync(path.join(tmpdir(), "docs-version-"));

  writeFileSync(
    path.join(root, "docusaurus.config.ts"),
    `const config = { versions: { current: { label: "${label}" } } };\nexport default config;\n`
  );
  writeFileSync(path.join(root, "versions.json"), JSON.stringify(frozen));
  for (const version of frozen) {
    mkdirSync(path.join(root, `versioned_docs/version-${version}`), { recursive: true });
  }

  return root;
}

function runCommand(root, target) {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath, target], {
      cwd: root,
      env: { ...process.env, DOCS_PROJECT_ROOT: root, DOCS_FREEZE_COMMAND: FREEZE_FIXTURE },
      encoding: "utf8",
    });

    return { status: 0, output: stdout };
  } catch (error) {
    return { status: error.status ?? 1, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

function labelOf(root) {
  const config = readFileSync(path.join(root, "docusaurus.config.ts"), "utf8");

  return /current:\s*\{\s*label:\s*"([^"]+)"\s*\}/.exec(config)?.[1];
}

function frozenOf(root) {
  return JSON.parse(readFileSync(path.join(root, "versions.json"), "utf8"));
}

test("missing checkpoint: freezes the outgoing label once and advances to the release", () => {
  const root = makeFixture({ label: "0.19.1-beta", frozen: ["0.19.0-beta"] });

  const result = runCommand(root, "0.20.0-beta");

  assert.equal(result.status, 0, result.output);
  assert.equal(labelOf(root), "0.20.0-beta");
  assert.deepEqual(frozenOf(root), ["0.19.1-beta", "0.19.0-beta"]);

  rmSync(root, { recursive: true, force: true });
});

test("already-current checkpoint: a rerun is a no-op", () => {
  const root = makeFixture({ label: "0.20.0-beta", frozen: ["0.19.1-beta", "0.19.0-beta"] });

  const result = runCommand(root, "0.20.0-beta");

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /already current/i);
  assert.equal(labelOf(root), "0.20.0-beta");
  assert.deepEqual(frozenOf(root), ["0.19.1-beta", "0.19.0-beta"]);

  rmSync(root, { recursive: true, force: true });
});

test("invalid forward drift: a label ahead of the release stops the workflow", () => {
  const root = makeFixture({ label: "0.21.0-beta", frozen: ["0.20.0-beta"] });

  const result = runCommand(root, "0.20.0-beta");

  assert.notEqual(result.status, 0);
  assert.match(result.output, /ahead/i);
  assert.equal(labelOf(root), "0.21.0-beta");

  rmSync(root, { recursive: true, force: true });
});

test("contradictory snapshots stop the workflow instead of freezing twice", () => {
  // The release is frozen although the editable label lags: never guess.
  const releaseFrozen = makeFixture({ label: "0.19.1-beta", frozen: ["0.20.0-beta"] });

  let result = runCommand(releaseFrozen, "0.20.0-beta");

  assert.notEqual(result.status, 0);
  assert.match(result.output, /contradictory/i);
  rmSync(releaseFrozen, { recursive: true, force: true });

  // The outgoing label already has a snapshot: freezing again would duplicate
  // the checkpoint directory.
  const labelFrozen = makeFixture({ label: "0.19.1-beta", frozen: ["0.19.1-beta"] });

  result = runCommand(labelFrozen, "0.20.0-beta");
  assert.notEqual(result.status, 0);
  assert.match(result.output, /contradictory/i);
  assert.equal(labelOf(labelFrozen), "0.19.1-beta");
  rmSync(labelFrozen, { recursive: true, force: true });
});
