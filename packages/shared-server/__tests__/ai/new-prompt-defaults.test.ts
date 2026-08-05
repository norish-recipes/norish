// @vitest-environment node
/**
 * The shipped defaults for the prompts added by the AI-architecture change.
 *
 * Asserted against the shipped prompt files rather than a mock, because the
 * file is what a deployment actually sends to the model. Admin overrides
 * replace them wholesale and are deliberately untouched by these
 * expectations.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadDefaultPrompts } from "@norish/shared-server/ai/prompts/loader";
import { resolveExistingWorkspacePath } from "@norish/shared-server/lib/workspace-paths";

const PROMPTS_DIR = resolveExistingWorkspacePath(
  join("packages", "shared-server", "src", "ai", "prompts")
);

function shipped(name: string): string {
  return readFileSync(join(PROMPTS_DIR, `${name}.txt`), "utf-8");
}

describe("the shipped auto-categorization prompt", () => {
  it("names the four categories and asks only for fitting ones", () => {
    const prompt = shipped("auto-categorization");

    expect(prompt).toContain("Breakfast, Lunch, Dinner, Snack");
    expect(prompt).toMatch(/only the categories that fit/i);
  });
});

describe("the shipped allergy-detection prompt", () => {
  it("restricts detection to the provided list and forbids guessing", () => {
    const prompt = shipped("allergy-detection");

    expect(prompt).toMatch(/allergens from the provided list/i);
    expect(prompt).toMatch(/do not guess or assume/i);
    // The list itself is appended by the feature; the prompt never carries one.
    expect(prompt).not.toMatch(/ALLERGENS TO DETECT:/);
  });
});

describe("loadDefaultPrompts", () => {
  it("ships a default for all nine administrator-editable prompts", () => {
    const defaults = loadDefaultPrompts();

    expect(Object.keys(defaults).sort()).toEqual(
      [
        "allergyDetection",
        "autoCategorization",
        "autoTagging",
        "imageExtraction",
        "ingredientLinking",
        "nutritionEstimation",
        "recipeExtraction",
        "recipeProvenance",
        "unitConversion",
      ].sort()
    );

    for (const [name, prompt] of Object.entries(defaults)) {
      expect(prompt, name).toBeTruthy();
    }
  });
});
