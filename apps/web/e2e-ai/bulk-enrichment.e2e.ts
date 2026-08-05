/**
 * Bulk Recipe Enrichment from the admin surface.
 *
 * The Enrich All Recipes action replaces the old bulk categorization: one
 * button that enrolls every recipe on the server through the coordinator with
 * the automatic origin, behind an explicit confirmation that names the cost.
 * These scenarios drive the real admin card, the real tRPC procedure, the
 * real queues and workers, and assert on the requests the fake provider
 * captured: the enabled automatic switches decide what runs, Supplied Recipe
 * Data still wins, and nothing at all runs from a cancelled confirmation or a
 * server whose AI is disabled.
 */
import type { BrowserContext, Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

import type { AIE2EStack } from "./harness";
import { E2E_BASE_URL, E2E_DATABASE_URL, USER_A } from "./env";
import {
  bootStack,
  readStoredCategories,
  setAutomaticEnrichment,
  signIn,
  submitPasteImport,
} from "./harness";

test.describe.configure({ mode: "serial" });

/** Extraction output with no categories and no nutrition: gaps to fill. */
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

/** Extraction output whose source supplied categories and complete nutrition. */
function suppliedRecipe(name: string) {
  return {
    ...bareRecipe(name),
    categories: ["Breakfast"],
    nutrition: { calories: 250, fat: 5, carbs: 30, protein: 10 },
  };
}

let stack: AIE2EStack | null = null;
let context: BrowserContext;
let page: Page;

/** Flip the stored AI enablement directly, the way setAutomaticEnrichment does. */
async function setAIEnabled(enabled: boolean): Promise<void> {
  const db = new Client({ connectionString: E2E_DATABASE_URL });

  await db.connect();

  try {
    await db.query(
      `update server_config
         set value = jsonb_set(value, '{enabled}', $1::jsonb, true)
       where key = 'ai_config'`,
      [JSON.stringify(enabled)]
    );
  } finally {
    await db.end();
  }
}

/** Import one recipe through the real AI paste path while automation is off. */
async function importRecipe(name: string, extraction: unknown): Promise<void> {
  const ai = stack!.ai;

  ai.control.reset();
  ai.control.enqueue({ kind: "success", content: JSON.stringify(extraction) });
  ai.control.setDefault(null);

  await page.goto("/");
  await submitPasteImport(page, `Import ${name} — the harness supplies the result.`);

  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("heading", { name, exact: true, level: 3 })).toBeVisible({
      timeout: 3_000,
    });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
}

/** Open the Bulk Enrichment panel of the AI & Processing card. */
async function openBulkPanel(): Promise<Locator> {
  await page.goto("/settings?tab=admin");

  const trigger = page.getByRole("button", { name: /^Bulk Enrichment/ }).first();

  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const panelId = await trigger.getAttribute("aria-controls");

  return page.locator(`[id="${panelId}"]`);
}

test.beforeAll(async ({ browser }) => {
  stack = await bootStack();

  const cookies = await signIn(USER_A);

  context = await browser.newContext({ baseURL: E2E_BASE_URL });
  await context.addCookies(cookies);
  page = await context.newPage();

  // Two recipes imported while every automatic switch is off, so creation-time
  // enrollment cannot contribute any of the requests asserted below.
  await setAutomaticEnrichment({});
  await importRecipe("Bulk Gap Stew", bareRecipe("Bulk Gap Stew"));
  await importRecipe("Bulk Supplied Stew", suppliedRecipe("Bulk Supplied Stew"));
});

test.afterAll(async () => {
  await setAIEnabled(true).catch(() => undefined);
  await setAutomaticEnrichment({}).catch(() => undefined);
  await context?.close();
  await stack?.stop().catch(() => undefined);
  stack = null;
});

test("with AI disabled the action refuses before queueing anything", async () => {
  await setAutomaticEnrichment({ autoCategorization: true });
  await setAIEnabled(false);

  const ai = stack!.ai;

  ai.control.reset();
  ai.control.setDefault(null);

  const panel = await openBulkPanel();

  await panel.getByRole("button", { name: "Enrich All Recipes" }).click();
  await expect(page.getByText("Run enrichment on all recipes?")).toBeVisible();
  await page.getByRole("button", { name: "Run on All Recipes" }).click();

  await expect(page.getByText("AI is disabled on this server. Enable AI first.")).toBeVisible({
    timeout: 15_000,
  });
  expect(ai.control.requestCount).toBe(0);

  await setAIEnabled(true);
});

test("cancelling the confirmation runs nothing", async () => {
  const ai = stack!.ai;

  ai.control.reset();
  ai.control.setDefault(null);

  const panel = await openBulkPanel();

  await panel.getByRole("button", { name: "Enrich All Recipes" }).click();
  await expect(page.getByText("Run enrichment on all recipes?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByText("Run enrichment on all recipes?")).toBeHidden();
  // Nothing was mutated, so there is nothing to await; a short settle keeps
  // this from passing merely by asserting faster than a queue could work.
  await page.waitForTimeout(1_000);
  expect(ai.control.requestCount).toBe(0);
});

test("a confirmed run fills gaps through enabled kinds and defers to supplied data", async () => {
  const ai = stack!.ai;

  ai.control.reset();
  ai.control.succeedWith({ categories: ["Dinner"] });

  const panel = await openBulkPanel();

  await panel.getByRole("button", { name: "Enrich All Recipes" }).click();
  await page.getByRole("button", { name: "Run on All Recipes" }).click();

  // The mutation reports what the coordinator decided: of two recipes, only
  // the one with a category gap enrolled the one enabled kind.
  await expect(panel.getByText("1 run queued across 2 recipes")).toBeVisible({
    timeout: 30_000,
  });

  // The queued worker completes the gap recipe from the controlled response.
  await expect
    .poll(async () => readStoredCategories("Bulk Gap Stew"), {
      timeout: 60_000,
      intervals: [1_000, 2_000, 5_000],
    })
    .toEqual(["Dinner"]);

  // Supplied Recipe Data won: the supplied recipe kept its category and the
  // provider was asked exactly once — for the gap recipe.
  expect(await readStoredCategories("Bulk Supplied Stew")).toEqual(["Breakfast"]);
  expect(ai.control.requestCount).toBe(1);
});
