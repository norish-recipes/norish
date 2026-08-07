/**
 * New default prompts must reach deployments that never customized them.
 *
 * The stored prompts row carries only administrator overrides; everything
 * else follows the shipped prompt files. These scenarios prove the full
 * story against the production server:
 *
 * 1. A clean install shows the shipped defaults in the admin form without
 *    pinning a copy of them in the database.
 * 2. An upgrade boot releases a pre-0.20 row frozen by the old row-level
 *    isOverridden flag — the admin form and the model both get the current
 *    defaults — while the one prompt the administrator actually wrote
 *    survives and keeps reaching the model.
 * 3. Saving the form stores only real edits, and reverting a prompt to the
 *    default text un-pins it, so a save can never freeze prompts again.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Page } from "@playwright/test";

import type { AIE2EStack, FakeAIProvider } from "./fixture";
import { expect, test } from "./fixture";
import { submitPasteImport } from "./import-support";
import { editPrompts, openPromptsPanel, readPromptsRow, writePromptsRow } from "./prompt-support";
import { setAutomaticEnrichment } from "./recipe-enrichment-support";

test.describe.configure({ mode: "serial" });

const REPO_ROOT = resolve(import.meta.dirname, "../../../../../");
const PROMPTS_DIR = join(REPO_ROOT, "packages", "shared-server", "src", "ai", "prompts");

/** The default text this build ships for a prompt, whitespace-normalized. */
function currentDefault(file: string): string {
  return readFileSync(join(PROMPTS_DIR, `${file}.txt`), "utf-8").trim();
}

/** The oldest default a release ever shipped for a field — what a long-lived deployment's database still holds. */
function oldestRetiredDefault(field: string): string {
  const retired = JSON.parse(
    readFileSync(join(PROMPTS_DIR, "retired-defaults.json"), "utf-8")
  ) as Record<string, string[] | undefined>;
  const oldest = retired[field]?.at(-1);

  if (!oldest) throw new Error(`retired-defaults.json records no retired default for "${field}".`);

  return oldest;
}

const FIELD_LABELS = {
  recipeExtraction: "Recipe Extraction Prompt",
  unitConversion: "Unit Conversion Prompt",
  nutritionEstimation: "Nutrition Estimation Prompt",
  autoTagging: "Auto-Tagging Prompt",
} as const;

/** Extraction output for imports driven through the fake provider. */
function bareRecipe(name: string) {
  return {
    name,
    description: null,
    notes: null,
    recipeYield: 4,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    recipeIngredient: {
      metric: ["200 g pinto beans", "1 L vegetable stock"],
      us: ["7 oz pinto beans", "4 cups vegetable stock"],
    },
    recipeInstructions: {
      metric: ["Simmer for 40 minutes.", "Season, then serve."],
      us: ["Simmer for 40 minutes.", "Season, then serve."],
    },
    keywords: null,
    allergyIndications: [],
    categories: [],
    nutrition: { calories: null, fat: null, carbs: null, protein: null },
  };
}

const CUSTOM_EXTRACTION =
  "Extract exactly one recipe and nothing else (custom extraction sentinel).";

let ai: FakeAIProvider;
let stack: AIE2EStack;
let page: Page;

test.beforeEach(async ({ aiStack, page: fixturePage }) => {
  stack = aiStack;
  ai = aiStack.ai;
  page = fixturePage;
  await writePromptsRow({});
  await setAutomaticEnrichment({});
});

test.afterEach(async () => {
  await setAutomaticEnrichment({}).catch(() => undefined);
  await writePromptsRow({}).catch(() => undefined);
});

/** The upgrade moment: the same database, a fresh server boot. */
async function restartServer(): Promise<void> {
  await stack.server.restartServer();
}

/** Poll a prompt textarea until it carries the expected text (the form fills asynchronously from the admin config query). */
async function expectPromptValue(
  panel: Awaited<ReturnType<typeof openPromptsPanel>>,
  label: string,
  expected: string
): Promise<void> {
  const field = panel.getByRole("textbox", { name: label, exact: true });

  await expect
    .poll(async () => (await field.inputValue()).trim(), { timeout: 15_000 })
    .toBe(expected.trim());
}

test("a clean install shows the shipped defaults without pinning them", async () => {
  const panel = await openPromptsPanel(page);

  for (const [field, label] of Object.entries(FIELD_LABELS)) {
    await expectPromptValue(panel, label, currentDefault(fileFor(field)));
  }

  // No stored copies: a pinned default is what goes stale at the next release.
  const row = await readPromptsRow();

  expect(row).toEqual({});
});

test("an upgrade releases prompts frozen by a pre-0.20 save and keeps the real customization", async () => {
  // A deployment that saved the prompts form once, long ago: the row is
  // flagged isOverridden and carries old shipped defaults — plus one prompt
  // the administrator genuinely wrote.
  const legacyRow: Record<string, string | boolean> = {
    recipeExtraction: CUSTOM_EXTRACTION,
    unitConversion: oldestRetiredDefault("unitConversion"),
    nutritionEstimation: oldestRetiredDefault("nutritionEstimation"),
    autoTagging: oldestRetiredDefault("autoTagging"),
    isOverridden: true,
  };

  // The scenario only bites while old and current defaults actually differ.
  for (const field of ["unitConversion", "nutritionEstimation", "autoTagging"] as const) {
    expect(legacyRow[field]).not.toBe(currentDefault(fileFor(field)));
  }

  await writePromptsRow(legacyRow);
  await restartServer();

  const panel = await openPromptsPanel(page);

  // The administrator's own prompt survived the upgrade…
  await expectPromptValue(panel, FIELD_LABELS.recipeExtraction, CUSTOM_EXTRACTION);

  // …and every seeded old default was released to the new shipped text.
  for (const field of ["unitConversion", "nutritionEstimation", "autoTagging"] as const) {
    await expectPromptValue(panel, FIELD_LABELS[field], currentDefault(fileFor(field)));
  }

  const row = await readPromptsRow();

  expect(row).toEqual({ recipeExtraction: CUSTOM_EXTRACTION });

  // The surviving customization is what extraction actually sends.
  await setAutomaticEnrichment({});
  ai.control.reset();
  ai.control.succeedWith(bareRecipe("Imported After The Upgrade"));

  await page.goto("/");
  await submitPasteImport(page, "Import a recipe — the harness supplies the result.");

  await expect(async () => {
    const texts = ai.control.requests.map((request) => JSON.stringify(request.body));

    expect(texts.some((text) => text.includes("custom extraction sentinel"))).toBe(true);
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000] });
});

test("saving pins only real edits, and reverting to the default text un-pins", async () => {
  // One save that reverts the custom extraction prompt to the shipped text
  // and writes a genuine auto-tagging edit: only the edit may be stored.
  const CUSTOM_TAGGING = "Tag with at most three nouns (custom tagging sentinel).";

  await writePromptsRow({ recipeExtraction: CUSTOM_EXTRACTION });

  await editPrompts(page, {
    [FIELD_LABELS.recipeExtraction]: currentDefault(fileFor("recipeExtraction")),
    [FIELD_LABELS.autoTagging]: CUSTOM_TAGGING,
  });

  expect(await readPromptsRow()).toEqual({ autoTagging: CUSTOM_TAGGING });

  // Reverting the remaining edit leaves the deployment fully on defaults.
  await editPrompts(page, {
    [FIELD_LABELS.autoTagging]: currentDefault(fileFor("autoTagging")),
  });

  expect(await readPromptsRow()).toEqual({});
});

/** Prompt file base name for a config field. */
function fileFor(field: string): string {
  const files: Record<string, string | undefined> = {
    recipeExtraction: "recipe-extraction",
    unitConversion: "unit-conversion",
    nutritionEstimation: "nutrition-estimation",
    autoTagging: "auto-tagging",
  };
  const file = files[field];

  if (!file) throw new Error(`No prompt file is mapped for the config field "${field}".`);

  return file;
}
