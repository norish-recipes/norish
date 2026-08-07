/**
 * Harness smoke scenario.
 *
 * Proves the production-like AI E2E seam end to end: a browser-triggered AI
 * paste import enqueues real background work, a real queued worker calls the
 * registered AI handler, that handler's third-party provider call is served by
 * the deterministic in-harness provider, and the controlled result is persisted
 * and rendered back in the browser. Only the AI-provider HTTP boundary is
 * replaced — tRPC, the queue worker, the repository, realtime, and the UI are
 * all genuinely exercised.
 *
 * This is the shared harness's own acceptance test; Recipe Enrichment uses the
 * same worker fixture and fresh authenticated page seam.
 */
import type { Page } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import { expect, test } from "./fixture";
import { submitPasteImport } from "./import-support";
import { setAutomaticEnrichment } from "./recipe-enrichment-support";

test.describe.configure({ mode: "serial" });

// A deterministic recipe the fake provider returns for the extraction call.
// The distinctive name can only reach the browser through the controlled
// provider response, since the pasted text carries no recipe content.
const SMOKE_RECIPE = {
  name: "Harness Verification Stew",
  description: "A deterministic recipe returned by the E2E AI provider.",
  notes: null,
  recipeYield: 4,
  prepTime: null,
  cookTime: null,
  totalTime: null,
  recipeIngredient: {
    metric: ["200 g pinto beans", "1 L vegetable stock", "2 cloves garlic"],
    us: ["7 oz pinto beans", "4 cups vegetable stock", "2 cloves garlic"],
  },
  recipeInstructions: {
    metric: ["Simmer the beans in the stock for 40 minutes.", "Season, then serve warm."],
    us: ["Simmer the beans in the stock for 40 minutes.", "Season, then serve warm."],
  },
  keywords: null,
  allergyIndications: [],
  categories: ["Dinner"],
  nutrition: { calories: 320, fat: 6, carbs: 48, protein: 16 },
};

let stack: AIE2EStack;
let page: Page;

test.beforeEach(async ({ aiStack, page: fixturePage }) => {
  stack = aiStack;
  page = fixturePage;
  await setAutomaticEnrichment({});
});

test("a browser AI paste import receives the controlled provider response", async () => {
  const ai = stack.ai;

  ai.control.succeedWith(SMOKE_RECIPE);

  await page.goto("/");

  // Start an AI-assisted paste import; the AI Import action is present
  // because the harness has AI enabled server-side.
  await submitPasteImport(
    page,
    "Please infer a recipe from this note — the harness supplies the result."
  );

  // The real queued worker persists the controlled recipe and the dashboard
  // refreshes to it. Reload on each attempt so a realtime event missed during
  // the post-submit navigation still resolves from server truth.
  await expect(async () => {
    await page.reload();
    await expect(page.getByText(SMOKE_RECIPE.name).first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });

  // The rendered name can only have come from the controlled provider, so a real
  // queued worker reached it — no real extraction or cached result is involved.
  expect(ai.control.requestCount).toBeGreaterThanOrEqual(1);
});
