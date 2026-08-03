// @vitest-environment node
/**
 * The shipped Ingredient Linking prompt.
 *
 * Asserted against the shipped prompt file rather than a mock, because the
 * file is what a deployment actually sends to the model. Admin overrides
 * replace it wholesale and are deliberately untouched by these expectations.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveExistingWorkspacePath } from "@norish/shared-server/lib/workspace-paths";

const LINKING_PROMPT = readFileSync(
  join(
    resolveExistingWorkspacePath(join("packages", "shared-server", "src", "ai", "prompts")),
    "ingredient-linking.txt"
  ),
  "utf-8"
);

describe("the shipped Ingredient Linking prompt", () => {
  it("binds aggregate phrases to every matching line", () => {
    expect(LINKING_PROMPT).toMatch(/"Add the spices" means every spice\s+line/i);
  });

  it("teaches fractional shares with the half-the-water example", () => {
    expect(LINKING_PROMPT).toMatch(/"Half the water" is 0\.5/);
    expect(LINKING_PROMPT).toMatch(/the share is 1/i);
  });

  it("lets steps that use nothing stay bare", () => {
    expect(LINKING_PROMPT).toMatch(/Omit steps that use nothing/i);
  });

  it("forbids invented numbers and heading links", () => {
    expect(LINKING_PROMPT).toMatch(/strictly by the numbers shown above/i);
    expect(LINKING_PROMPT).toMatch(/never link a section heading/i);
  });

  it("prefers unlinked over guessed", () => {
    expect(LINKING_PROMPT).toMatch(/leave that phrase unlinked rather than guessing/i);
  });

  it("keeps every template variable the loader fills", () => {
    for (const variable of ["recipeName", "ingredients", "steps"]) {
      expect(LINKING_PROMPT).toContain(`{{${variable}}}`);
    }
  });
});
