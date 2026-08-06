// @vitest-environment node
/**
 * retired-defaults.json is the boot migration's memory of every default text
 * a release ever shipped: it is how a stored copy of an old default is told
 * apart from a prompt an administrator wrote. It is generated from git
 * history by tooling/monorepo/scripts/generate-retired-prompt-defaults.mjs.
 */
import { describe, expect, it } from "vitest";

import {
  loadDefaultPrompts,
  loadRetiredDefaultPrompts,
} from "@norish/shared-server/ai/prompts/loader";
import { isSamePromptText, PROMPT_CONFIG_FIELDS } from "@norish/shared-server/ai/prompts/overrides";

describe("retired-defaults.json", () => {
  it("carries variants for every administrator-editable prompt", () => {
    const retired = loadRetiredDefaultPrompts();

    for (const field of PROMPT_CONFIG_FIELDS) {
      expect(retired[field]?.length, field).toBeGreaterThanOrEqual(1);
    }
  });

  it("includes the currently shipped default of every prompt — regenerate after editing one", () => {
    // A release whose new prompt text is missing here would leave databases
    // that stored it pinned forever once the next release changes it again.
    // Fix: node tooling/monorepo/scripts/generate-retired-prompt-defaults.mjs
    const defaults = loadDefaultPrompts();
    const retired = loadRetiredDefaultPrompts();

    for (const field of PROMPT_CONFIG_FIELDS) {
      const variants = retired[field] ?? [];

      expect(
        variants.some((variant) => isSamePromptText(variant, defaults[field])),
        `${field}: current default missing from retired-defaults.json`
      ).toBe(true);
    }
  });

  it("remembers pre-0.20 texts for the prompts that existed before 0.20", () => {
    // These four shipped in several wordings between 0.14 and 0.19; those
    // wordings sit in real deployments' databases and must stay recognizable.
    const retired = loadRetiredDefaultPrompts();

    for (const field of [
      "recipeExtraction",
      "unitConversion",
      "nutritionEstimation",
      "autoTagging",
    ] as const) {
      expect(retired[field]?.length, field).toBeGreaterThanOrEqual(2);
    }
  });
});
