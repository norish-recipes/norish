// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_TARGETS,
  resolveExistingTargets,
} from "../../tooling/monorepo/scripts/check-circular-deps.mjs";

describe("resolveExistingTargets", () => {
  it("filters out missing directories", () => {
    const root = mkdtempSync(join(tmpdir(), "norish-cycles-"));

    try {
      mkdirSync(join(root, "app"));
      mkdirSync(join(root, "stores"));

      const result = resolveExistingTargets(root, ["app", "store", "stores"]);

      expect(result).toEqual(["app", "stores"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("excludes legacy server roots from defaults", () => {
    expect(DEFAULT_TARGETS).not.toContain("server");
  });
});
