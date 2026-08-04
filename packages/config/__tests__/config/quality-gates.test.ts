// @vitest-environment node
/**
 * The quality gates have to be able to fail.
 *
 * Format Check ran `pnpm run format` — the write script — against a throwaway
 * CI checkout. Prettier reformatted the runner's copy and exited zero however
 * the branch was shaped, so the gate went green on drift for long enough to
 * accumulate roughly 1,500 lines of it. The Tests gate had the mirror problem:
 * it inherited the workflow-wide NODE_ENV=production, under which Vite resolves
 * Node builtins as browser externals and every jsdom suite that reaches one
 * dies with "No such built-in module: node:" before a single test runs.
 *
 * Neither fault is visible in a green run, which is why they are pinned here.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../../..");

const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/_node-ci.yml"), "utf8");

const rootScripts: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
).scripts;

/**
 * The gate entries the workflow shell-builds into its matrix, one JSON object
 * per `entries+=(...)` line.
 */
const gates: { name: string; command: string; nodeEnv: string }[] = [
  ...workflow.matchAll(/entries\+=\('(\{[^']*\})'\)/g),
].map((match) => JSON.parse(match[1]!));

const gate = (name: string) => gates.find((entry) => entry.name === name);

/** The root script a `pnpm run <script>` gate command resolves to. */
const scriptFor = (command: string) => rootScripts[/^pnpm run (\S+)$/.exec(command)?.[1] ?? ""];

describe("CI quality gates", () => {
  it("plans a gate for tests, lint, formatting and locale keys", () => {
    expect(gates.map((entry) => entry.name)).toEqual([
      "Tests",
      "Lint",
      "Format Check",
      "Locale Keys Check",
    ]);
  });

  it("runs every gate through a root script", () => {
    for (const entry of gates) {
      expect(scriptFor(entry.command), entry.name).toBeDefined();
    }
  });
});

describe("the Format Check gate", () => {
  it("reports formatting rather than rewriting the checkout", () => {
    expect(scriptFor(gate("Format Check")!.command)).not.toContain("--write");
  });
});

describe("the Tests gate", () => {
  it("runs under the NODE_ENV Vitest expects", () => {
    expect(gate("Tests")!.nodeEnv).toBe("test");
  });

  it("is the only gate that needs one", () => {
    const others = gates.filter((entry) => entry.name !== "Tests");

    expect(others.map((entry) => entry.nodeEnv)).toEqual(others.map(() => "production"));
  });
});
