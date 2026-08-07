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
 *
 * The gates used to be a build-a-matrix shell loop and are now plain steps in a
 * single job, so this reads the steps directly. Nothing about either fault is
 * specific to that shape — a step can be pointed at the write script, or lose
 * its NODE_ENV, exactly as a matrix entry could.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../../..");

const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/_node-ci.yml"), "utf8");

const rootScripts: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
).scripts;

/** The workflow-level NODE_ENV every step inherits unless it says otherwise. */
const workflowNodeEnv = /^env:\n(?:[ \t]+.*\n)*?[ \t]+NODE_ENV:[ \t]*(\S+)/m
  .exec(workflow)?.[1]
  ?.replaceAll('"', "");

interface Step {
  name: string;
  run: string | undefined;
  /** The step's own NODE_ENV override, if it declares one. */
  nodeEnv: string | undefined;
}

/**
 * The steps of the single `verify` job, in file order. Steps are the six-space
 * indented `- name:` entries; splitting on that boundary keeps each step's own
 * `run:`/`env:` block with it.
 */
const steps: Step[] = workflow
  .split(/^ {6}- (?=name:)/m)
  .slice(1)
  .map((block) => ({
    name: /^name:[ \t]*(.+)$/m.exec(block)![1]!.trim(),
    run: /^ {8}run:[ \t]*(.+)$/m.exec(block)?.[1]?.trim(),
    nodeEnv: /^ {8}env:\n(?:[ \t]+.*\n)*?[ \t]+NODE_ENV:[ \t]*(\S+)/m
      .exec(block)?.[1]
      ?.replaceAll('"', ""),
  }));

const step = (name: string) => steps.find((entry) => entry.name === name);

/**
 * The gate steps — the ones that can report a red for the branch's own quality,
 * as opposed to setup, build and artifact-upload plumbing.
 */
const GATE_NAMES = [
  "Dependency cycles",
  "Format check",
  "Locale keys check",
  "Lint",
  "Tests",
  "Browser E2E",
] as const;

const gates = GATE_NAMES.map((name) => step(name));

/**
 * The script a gate command resolves to, whether it runs at the root
 * (`pnpm run x`) or in one workspace (`pnpm --filter @norish/web run x`).
 */
function scriptFor(command: string | undefined): string | undefined {
  const root = /^pnpm run (\S+)$/.exec(command ?? "")?.[1];

  if (root) return rootScripts[root];

  const filtered = /^pnpm --filter (\S+) run (\S+)$/.exec(command ?? "");

  if (!filtered) return undefined;

  const workspace = workspaces.find((entry) => nameOf(entry) === filtered[1]);

  return workspace ? scriptsOf(workspace)[filtered[2]!] : undefined;
}

/** The workspaces `turbo run <task>` fans a gate out to. */
const workspaces = (() => {
  const globs = (
    /^packages:\n((?:[ \t]+-.*\n)+)/m.exec(
      fs.readFileSync(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8")
    )?.[1] ?? ""
  )
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*-\s*/, "")
        .replaceAll('"', "")
        .trim()
    )
    .filter(Boolean);

  const excluded = new Set(
    globs.filter((glob) => glob.startsWith("!")).map((glob) => glob.slice(1))
  );

  return globs
    .filter((glob) => glob.endsWith("/*"))
    .flatMap((glob) => {
      const parent = glob.slice(0, -2);

      return fs.readdirSync(path.join(repoRoot, parent)).map((entry) => `${parent}/${entry}`);
    })
    .filter(
      (workspace) =>
        !excluded.has(workspace) && fs.existsSync(path.join(repoRoot, workspace, "package.json"))
    );
})();

function manifestOf(workspace: string): { name?: string; scripts?: Record<string, string> } {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, workspace, "package.json"), "utf8"));
}

const nameOf = (workspace: string) => manifestOf(workspace).name;
const scriptsOf = (workspace: string) => manifestOf(workspace).scripts ?? {};

/** Every workspace `format` script, as [workspace, script] pairs. */
const workspaceFormatScripts = workspaces.flatMap((workspace) => {
  const format = scriptsOf(workspace).format;

  return format ? [[workspace, format] as const] : [];
});

describe("CI quality gates", () => {
  it("plans a gate for tests, lint, formatting and locale keys", () => {
    expect(steps.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(["Tests", "Lint", "Format check", "Locale keys check"])
    );
  });

  it("keeps every planned gate present in the workflow", () => {
    for (const [index, entry] of gates.entries()) {
      expect(entry, GATE_NAMES[index]).toBeDefined();
    }
  });

  it("runs every gate through a package script", () => {
    for (const entry of gates) {
      expect(scriptFor(entry!.run), entry!.name).toBeDefined();
    }
  });

  // A gate guarded on the gate before it turns one red into a cascade of
  // skips, which reads as "not run" rather than "not reached". Each is guarded
  // on the install (or, past the build, on the build) instead.
  it("guards each gate so one red still lets the rest report", () => {
    for (const entry of gates) {
      const block = workflow.split(/^ {6}- (?=name:)/m).find((part) => part.includes(entry!.name))!;

      expect(block, entry!.name).toMatch(/steps\.(setup|build)\.outcome == 'success'/);
    }
  });
});

describe("the Format Check gate", () => {
  it("reports formatting rather than rewriting the checkout", () => {
    expect(scriptFor(step("Format check")!.run)).not.toContain("--write");
  });

  // The root script only orchestrates: it runs `format` in every workspace. A
  // single workspace script flipped to --write puts that workspace back to
  // never being able to fail, and the root check above would not notice.
  it("reaches no workspace script that rewrites instead", () => {
    expect(workspaceFormatScripts.length).toBeGreaterThan(0);

    for (const [workspace, script] of workspaceFormatScripts) {
      expect(script, workspace).not.toContain("--write");
    }
  });
});

describe("the Tests gate", () => {
  it("runs under the NODE_ENV Vitest expects", () => {
    expect(step("Tests")!.nodeEnv).toBe("test");
  });

  // The override only means anything against a workflow default that would
  // otherwise break the suite; if that default ever becomes "test", the guard
  // above stops proving anything and should be revisited rather than deleted.
  it("overrides a workflow default that would break the suite", () => {
    expect(workflowNodeEnv).toBe("production");
  });

  it("leaves every other gate on the workflow's production default", () => {
    const others = gates.filter((entry) => entry!.name !== "Tests");

    expect(others.map((entry) => entry!.nodeEnv ?? workflowNodeEnv)).toEqual(
      others.map(() => "production")
    );
  });
});
