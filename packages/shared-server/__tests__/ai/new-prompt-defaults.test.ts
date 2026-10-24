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

describe("the shipped ingredient-resolution prompt", () => {
  it("asks whether a name is one food, several or none, and for doubt to be said", () => {
    const prompt = shipped("ingredient-resolution");
    const oneLine = prompt.replace(/\s+/g, " ");

    expect(oneLine).toContain("A name identifies several foods");
    expect(oneLine).toContain("is not a food");
    expect(oneLine).toContain(
      "Give two or three other names a shop might sell the same food under; Norish finds the food by them."
    );
    expect(oneLine).toMatch(/"sure" to false/);
    expect(oneLine).toContain("based on Open Food Facts' ingredient names");
    // The name and the parent it is filed under are appended by the resolver.
    expect(prompt).not.toMatch(/\{\{/);
  });
});

describe("the shipped ingredient-match prompt", () => {
  it("asks which listed food the name is exactly, and for none when in doubt", () => {
    const prompt = shipped("ingredient-match");
    const oneLine = prompt.replace(/\s+/g, " ");

    expect(oneLine).toContain("exactly the item the name asks for");
    expect(oneLine).toContain("When in doubt, match none");
    // The name and the found foods are appended by the resolver.
    expect(prompt).not.toMatch(/\{\{/);
  });
});

describe("loadDefaultPrompts", () => {
  it("ships a default for all seventeen administrator-editable prompts", () => {
    const defaults = loadDefaultPrompts();

    expect(Object.keys(defaults).sort()).toEqual(
      [
        "allergyDetection",
        "autoCategorization",
        "autoTagging",
        "imageExtraction",
        "imageGenerationBrief",
        "imageGenerationStyle",
        "ingredientIconStyle",
        "ingredientPlainName",
        "ingredientSpellingCheck",
        "ingredientNutrition",
        "ingredientLinking",
        "ingredientMatch",
        "ingredientResolution",
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
