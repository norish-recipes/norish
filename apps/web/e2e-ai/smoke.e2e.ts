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
 * This is the harness's own acceptance test; the Recipe Enrichment scenarios
 * reuse the same `bootStack`/`signIn` seam.
 */
import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import type { AIE2EStack } from "./harness";
import { E2E_BASE_URL, USER_A } from "./env";
import { bootStack, signIn, submitPasteImport } from "./harness";

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

let stack: AIE2EStack | null = null;
let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  stack = await bootStack();

  const cookies = await signIn(USER_A);

  context = await browser.newContext({ baseURL: E2E_BASE_URL });
  await context.addCookies(cookies);
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
  await stack?.stop().catch(() => undefined);
  stack = null;
});

test("a browser AI paste import receives the controlled provider response", async () => {
  const ai = stack!.ai;

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
