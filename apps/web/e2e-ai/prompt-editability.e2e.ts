/**
 * Administrator-editable prompts, proven at the wire.
 *
 * Every request starts from an administrator-editable prompt, so editing one
 * through the admin surface must change what reaches the model — and must
 * never change what a different feature sends. These scenarios drive the real
 * admin form, run the real enrichment and import flows, and assert on the
 * requests the fake provider captured.
 *
 * This is the test that proves the tunability gap is closed for
 * auto-categorization and allergy detection, and that image extraction runs
 * under its own prompt rather than a rewritten copy of the webpage one.
 */
import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import type { AIE2EStack, SessionCookies } from "./harness";
import { E2E_BASE_URL, USER_A } from "./env";
import {
  bootStack,
  editPrompts,
  setAutomaticEnrichment,
  signIn,
  submitImageImport,
  submitPasteImport,
  supplyUserAllergies,
} from "./harness";

test.describe.configure({ mode: "serial" });

/** Extraction output for the import that precedes an enrichment run. */
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

let stack: AIE2EStack | null = null;
let context: BrowserContext;
let page: Page;
let cookies: SessionCookies;

test.beforeAll(async ({ browser }) => {
  stack = await bootStack();

  cookies = await signIn(USER_A);

  context = await browser.newContext({ baseURL: E2E_BASE_URL });
  await context.addCookies(cookies);
  page = await context.newPage();
});

test.afterAll(async () => {
  await setAutomaticEnrichment({}).catch(() => undefined);
  await context?.close();
  await stack?.stop().catch(() => undefined);
  stack = null;
});

/** The composed text of every captured request, oldest first. */
function capturedTexts(): string[] {
  return stack!.ai.control.requests.map((request) => JSON.stringify(request.body));
}

test("an edited auto-categorization prompt reaches the model", async () => {
  const SENTINEL = "PREFER SNACK WHEN THE DISH IS FINGER FOOD (categorization sentinel).";
  const ai = stack!.ai;

  await editPrompts(page, { "Auto-Categorization Prompt": SENTINEL });
  await setAutomaticEnrichment({ autoCategorization: true });

  ai.control.reset();
  ai.control.enqueue(
    { kind: "success", content: JSON.stringify(bareRecipe("Categorized By Edited Prompt")) },
    { kind: "success", content: JSON.stringify({ categories: ["Snack"] }) }
  );
  ai.control.setDefault(null);

  await page.goto("/");
  await submitPasteImport(page, "Import a recipe — the harness supplies the result.");

  // The categorization request is the one carrying the edited prompt.
  await expect(async () => {
    expect(capturedTexts().some((text) => text.includes("categorization sentinel"))).toBe(true);
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000] });

  // The import's extraction request ran under a different prompt, untouched.
  expect(capturedTexts()[0]).not.toContain("categorization sentinel");
});

test("an edited allergy-detection prompt reaches the model, with the household's allergens appended", async () => {
  const SENTINEL = "TREAT CROSS-CONTAMINATION AS PRESENCE (allergy sentinel).";
  const ai = stack!.ai;

  await supplyUserAllergies(cookies, ["peanut"]);
  await editPrompts(page, { "Allergy Detection Prompt": SENTINEL });
  await setAutomaticEnrichment({ allergyDetection: true });

  ai.control.reset();
  ai.control.enqueue(
    { kind: "success", content: JSON.stringify(bareRecipe("Checked By Edited Prompt")) },
    { kind: "success", content: JSON.stringify({ detectedAllergens: [] }) }
  );
  ai.control.setDefault(null);

  await page.goto("/");
  await submitPasteImport(page, "Import another recipe — the harness supplies the result.");

  await expect(async () => {
    expect(capturedTexts().some((text) => text.includes("allergy sentinel"))).toBe(true);
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000] });

  // The household's configured allergens are appended after the edited prompt,
  // not lost with it: append semantics keep a customised prompt working.
  const request = capturedTexts().find((text) => text.includes("allergy sentinel"))!;

  expect(request).toContain("ALLERGENS TO DETECT");
  expect(request).toContain("peanut");
});

test("image extraction runs under its own prompt, and editing the webpage prompt does not alter it", async () => {
  const EXTRACTION_SENTINEL = "READ THE BYLINE CAREFULLY (webpage extraction sentinel).";
  const IMAGE_SENTINEL = "THE PHOTOS MAY BE HANDWRITTEN (image extraction sentinel).";
  const ai = stack!.ai;

  await setAutomaticEnrichment({});
  await editPrompts(page, {
    "Recipe Extraction Prompt": EXTRACTION_SENTINEL,
    "Image Extraction Prompt": IMAGE_SENTINEL,
  });

  ai.control.reset();
  ai.control.succeedWith(bareRecipe("Photographed Under Its Own Prompt"));

  await page.goto("/");
  await submitImageImport(page);

  await expect(async () => {
    expect(ai.control.requestCount).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000] });

  // The vision request carries image extraction's own edited prompt — and not
  // the webpage-extraction prompt that used to be rewritten into service.
  const imageRequest = capturedTexts().at(-1)!;

  expect(imageRequest).toContain("image extraction sentinel");
  expect(imageRequest).not.toContain("webpage extraction sentinel");

  // And the webpage prompt still belongs to URL/paste extraction.
  ai.control.reset();
  ai.control.succeedWith(bareRecipe("Extracted Under The Webpage Prompt"));

  await submitPasteImport(page, "Import one more recipe — the harness supplies the result.");

  await expect(async () => {
    expect(capturedTexts().some((text) => text.includes("webpage extraction sentinel"))).toBe(true);
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000] });
});
