/**
 * Decision Model browser scenarios (ADR-0035).
 *
 * The Decision block is configured through the real admin mutation and points
 * at the harness's fake provider, whose TypeSafe evaluation route answers over
 * loopback exactly as the production route would. Everything else — the
 * server, the queue workers, the AI Runtime's `decide`, the repositories and
 * the browser — is genuinely in the path. What is proven here is the loop no
 * unit seam can: a queued enrichment settled by a Decision reaches the recipe
 * page without the AI provider being asked, and an unsure Decision hands the
 * kind back to the AI provider whose answer the Decision Model then checks.
 */
import type { Page } from "@playwright/test";
import { request } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import type { TypeSafeAnswer } from "../harness/ai-provider";
import { expect, test } from "./fixture";
import { submitPasteImport } from "./import-support";
import { readStoredCategories, setAutomaticEnrichment } from "./recipe-enrichment-support";

test.describe.configure({ mode: "serial" });

/** Extraction output with no categories: enrichment territory. */
function bareRecipe(name: string) {
  return {
    name,
    description: "A deterministic recipe returned by the E2E AI provider.",
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

function boolean(probability: number): TypeSafeAnswer {
  return { type: "noul", noul: probability };
}

/**
 * Every question an import and its categorization can ask, answered at once:
 * the runtime reads only the ids it asked for, so one persistent answer set
 * serves triage, the extraction's shadow score, the kind and validation.
 */
function answers(categories: Record<"Breakfast" | "Lunch" | "Dinner" | "Snack", number>) {
  return {
    isRecipe: boolean(0.99),
    completeness: { type: "score" as const, score: 2, probabilities: { 0: 0.01, 1: 0.04, 2: 0.95 } },
    faithfulness: { type: "score" as const, score: 2, probabilities: { 0: 0.01, 1: 0.04, 2: 0.95 } },
    Breakfast: boolean(categories.Breakfast),
    Lunch: boolean(categories.Lunch),
    Dinner: boolean(categories.Dinner),
    Snack: boolean(categories.Snack),
  };
}

let stack: AIE2EStack;
let page: Page;

test.beforeEach(({ aiStack, page: fixturePage }) => {
  stack = aiStack;
  page = fixturePage;
});

test.afterAll(async () => {
  await setAutomaticEnrichment({}).catch(() => undefined);
  await configureDecisionModel({ provider: "disabled" }).catch(() => undefined);
});

/** Save the Decision block through the admin mutation, as the form does. */
async function configureDecisionModel(config: {
  provider: "typesafe" | "disabled";
  apiKey?: string;
  endpoint?: string;
}): Promise<void> {
  const api = await request.newContext({
    baseURL: stack.baseURL,
    extraHTTPHeaders: {
      origin: stack.baseURL,
      cookie: stack.ownerCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
  });

  try {
    const response = await api.post("/api/trpc/admin.updateDecisionConfig", {
      data: { json: config },
    });

    if (!response.ok()) {
      throw new Error(`updateDecisionConfig failed: ${response.status()} ${await response.text()}`);
    }
  } finally {
    await api.dispose();
  }
}

/** Point the Decision block at the fake provider's TypeSafe route. */
async function decisionModelAtHarness(): Promise<void> {
  await configureDecisionModel({
    provider: "typesafe",
    apiKey: "ts-e2e-key",
    endpoint: `${stack.ai.url}/v1`,
  });
}

/** Import one recipe through the real AI paste path and open it. */
async function importAndOpen(name: string, chatDirectives: unknown[]): Promise<void> {
  const ai = stack.ai;

  ai.control.enqueue(
    ...chatDirectives.map((json) => ({ kind: "success" as const, content: JSON.stringify(json) }))
  );
  // Anything beyond the queued chat directives is a bug in the scenario, not
  // silent extra AI work: fail loudly rather than answering it.
  ai.control.setDefault(null);

  await page.goto("/");
  await submitPasteImport(page, `Import ${name} — the harness supplies the result.`);

  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("heading", { name, exact: true, level: 3 })).toBeVisible({
      timeout: 3_000,
    });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });

  await page.getByRole("heading", { name, exact: true, level: 3 }).click();
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible({ timeout: 15_000 });
}

/** Poll the open recipe page until the assertion holds, reloading each attempt. */
async function eventuallyOnRecipe(assertion: () => Promise<void>): Promise<void> {
  await expect(async () => {
    await page.reload();
    await assertion();
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
}

/** Chat completions the AI provider served: everything that was not a Decision or an image. */
function chatRequestCount(): number {
  const { control } = stack.ai;

  return control.requestCount - control.decisionRequestCount - control.imageRequestCount;
}

test("a Decision settles automatic categorization, and the AI provider is never asked for it", async () => {
  await decisionModelAtHarness();
  await setAutomaticEnrichment({ autoCategorization: true });
  stack.ai.control.reset();
  stack.ai.control.decideWith(answers({ Breakfast: 0.02, Lunch: 0.03, Dinner: 0.97, Snack: 0.01 }));

  await importAndOpen("Decision Categories Stew", [bareRecipe("Decision Categories Stew")]);

  await eventuallyOnRecipe(async () => {
    await expect(page.getByText("Dinner").first()).toBeVisible({ timeout: 3_000 });
  });
  expect(await readStoredCategories("Decision Categories Stew")).toEqual(["Dinner"]);

  // The Decision went over loopback to the harness's TypeSafe route, and the
  // one chat completion was the extraction: categorization never reached the
  // AI provider.
  expect(stack.ai.control.decisionRequestCount).toBeGreaterThanOrEqual(1);
  expect(chatRequestCount()).toBe(1);
});

test("an unsure Decision hands categorization to the AI provider, whose answer is then checked", async () => {
  await decisionModelAtHarness();
  await setAutomaticEnrichment({ autoCategorization: true });
  stack.ai.control.reset();
  // Nothing clears the category threshold, and the validation question on
  // the AI provider's answer ("Lunch") is answered from the same set: kept.
  stack.ai.control.decideWith(answers({ Breakfast: 0.5, Lunch: 0.5, Dinner: 0.5, Snack: 0.5 }));

  await importAndOpen("Unsure Decision Stew", [
    bareRecipe("Unsure Decision Stew"),
    { categories: ["Lunch"] },
  ]);

  await eventuallyOnRecipe(async () => {
    await expect(page.getByText("Lunch").first()).toBeVisible({ timeout: 3_000 });
  });
  expect(await readStoredCategories("Unsure Decision Stew")).toEqual(["Lunch"]);

  // The extraction and the categorization both went to the AI provider; the
  // Decision Model was asked at least twice, for the kind and for its check.
  expect(chatRequestCount()).toBe(2);
  expect(stack.ai.control.decisionRequestCount).toBeGreaterThanOrEqual(2);
});

test("a disabled Decision block leaves every kind to the AI provider", async () => {
  await configureDecisionModel({ provider: "disabled" });
  await setAutomaticEnrichment({ autoCategorization: true });
  stack.ai.control.reset();
  stack.ai.control.setDecisionDefault(null);

  await importAndOpen("No Decision Stew", [bareRecipe("No Decision Stew"), { categories: ["Snack"] }]);

  await eventuallyOnRecipe(async () => {
    await expect(page.getByText("Snack").first()).toBeVisible({ timeout: 3_000 });
  });
  expect(await readStoredCategories("No Decision Stew")).toEqual(["Snack"]);

  expect(stack.ai.control.decisionRequestCount).toBe(0);
  expect(chatRequestCount()).toBe(2);
});
