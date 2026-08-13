// @vitest-environment node

/**
 * Design invariants for the web app, read straight from its source.
 *
 * Norish does not fake glass (docs/adr/ui/0020-norish-does-not-fake-glass.md):
 * every backdrop-blur and blur utility left the app with tickets 07-09, and
 * the four shared glass tokens were deleted so there is nothing to reach
 * for. This suite is what keeps that permanent instead of a thing a reviewer
 * has to notice — it fails when blur comes back, when the tokens are
 * reintroduced, or when the handrolled segmented control the Tabs migration
 * deleted reappears beside its replacement.
 *
 * Deliberately not caught: modal backdrops that dim the page. A scrim over
 * content is allowed; a surface pretending to be a material is not. The
 * scrims are plain translucent fills with no blur, so a rule anchored on
 * blur utilities and backdrop-filter never sees them.
 *
 * Prior art for a source-reading gate is the quality-gates suite in
 * packages/config.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ADR = "docs/adr/ui/0020-norish-does-not-fake-glass.md";

const webRoot = path.resolve(import.meta.dirname, "..");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".css"]);

// Build output, dependencies and tests are not the app's shipped source. A
// mis-cwd'd install can also leave a stray nested `apps/` tree behind —
// skip it rather than reading a stale copy of the app.
const IGNORED_DIRECTORIES = new Set([
  ".cache",
  ".next",
  ".turbo",
  "__tests__",
  "apps",
  "build",
  "dist",
  "dist-server",
  "node_modules",
  "public",
  "test-results",
]);

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      files.push(...collectSourceFiles(path.join(dir, entry.name)));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name));
    }
  }

  return files;
}

const sourceFiles = collectSourceFiles(webRoot);

const sources = sourceFiles.map((file) => ({
  file: path.relative(webRoot, file),
  text: fs.readFileSync(file, "utf8"),
}));

function filesMatching(pattern: RegExp): string[] {
  return sources.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
}

describe("design invariants", () => {
  it("actually walked the app's source", () => {
    // A broken walk must not read as a green run.
    expect(sourceFiles.length).toBeGreaterThan(300);
  });

  it("keeps backdrop-filter out of the web app", () => {
    expect(
      filesMatching(/backdrop-blur|backdrop-filter/),
      `Fake glass came back — Norish does not fake glass, see ${ADR}. ` +
        `Anything that floats is an opaque object from the token set.`
    ).toEqual([]);
  });

  it("keeps blur utilities out of the web app", () => {
    expect(
      filesMatching(/\bblur-(?:none|xs|sm|md|lg|xl|2xl|3xl|\[)/),
      `A blur utility came back — Norish does not fake glass, see ${ADR}. ` +
        `Soft glows are drawn with gradients, not blur compositing.`
    ).toEqual([]);
  });

  it("keeps the deleted glass tokens deleted", () => {
    expect(
      filesMatching(/cssGlassBackdrop/),
      `A shared glass token was reintroduced — their absence is the ` +
        `enforcement of ${ADR}; with no token to reach for, glass has to be ` +
        `written out by hand, which the rules above catch.`
    ).toEqual([]);
  });

  it("keeps the handrolled segmented control deleted", () => {
    expect(
      fs.existsSync(path.join(webRoot, "components/ui/segment.tsx")),
      `components/ui/segment.tsx is back — the library view switch moved ` +
        `onto HeroUI Tabs (3.2.4 gave the tab list the segmented look), and ` +
        `the handrolled control was deleted rather than left beside its ` +
        `replacement.`
    ).toBe(false);

    expect(
      filesMatching(/\bSegmentRoot\b|\bSegmentedControl\b/),
      `A handrolled segmented control reappeared — build it on HeroUI Tabs ` +
        `instead; the old control was deleted when the library view switch ` +
        `moved onto Tabs.`
    ).toEqual([]);
  });
});
