/**
 * Ingredient Linking browser scenarios.
 *
 * The cross-cutting flows that only exist once every piece has shipped: an
 * import followed by a manual run from the actions menu, the aggregate step
 * carrying several lines, "half the water" rendering the computed amount,
 * gap-filling leaving a hand-attached chip untouched while bare steps fill,
 * and the reading surfaces — recipe page, cooking mode, and share page —
 * presenting the resolved amounts.
 *
 * Only the AI provider's HTTP boundary is faked. The real Norish server,
 * database, Redis, BullMQ workers, repositories, authorized mutation layer,
 * realtime connection, and UI are all exercised.
 */
import type { BrowserContext, Page } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import { expect, test } from "./fixture";
import { submitPasteImport } from "./import-support";
import { readStoredStepIngredients, supplyStepIngredient } from "./ingredient-linking-support";
import { setAutomaticEnrichment } from "./recipe-enrichment-support";

test.describe.configure({ mode: "serial" });

/** Extraction output with spices to aggregate and water to halve. */
function linkableRecipe(name: string) {
  return {
    name,
    description: "A deterministic recipe returned by the E2E AI provider.",
    notes: null,
    recipeYield: 2,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    recipeIngredient: {
      metric: ["5 g salt", "3 g pepper", "2 g paprika", "50 ml water"],
      us: ["1 tsp salt", "0.5 tsp pepper", "0.5 tsp paprika", "0.25 cup water"],
    },
    recipeInstructions: {
      metric: ["Add the spices.", "Add half the water.", "Serve."],
      us: ["Add the spices.", "Add half the water.", "Serve."],
    },
    keywords: null,
    allergyIndications: [],
    categories: [],
    nutrition: { calories: null, fat: null, carbs: null, protein: null },
  };
}

/**
 * The linking claim as the model would return it, in the prompt's own
 * numbering: lines and steps numbered 1..n over the linkable rows. The water
 * link states an amount — 25 of the 50 ml line — rather than a share: the
 * claim passes the real output schema and the inferrer does the division, so
 * the stored share is 0.5 and every surface still derives 25 ml from it.
 */
const LINKING_CLAIM = {
  links: [
    {
      step: 1,
      ingredients: [
        { line: 1, share: 1, amount: null },
        { line: 2, share: 1, amount: null },
        { line: 3, share: 1, amount: null },
      ],
    },
    { step: 2, ingredients: [{ line: 4, share: null, amount: 25 }] },
  ],
};

let stack: AIE2EStack;
let context: BrowserContext;
let page: Page;

test.beforeEach(({ aiStack, context: fixtureContext, page: fixturePage }) => {
  stack = aiStack;
  context = fixtureContext;
  page = fixturePage;
});

test.afterEach(async () => {
  await setAutomaticEnrichment({}).catch(() => undefined);
});

async function openRecipe(name: string): Promise<void> {
  // Always from the dashboard: scenarios may leave the page anywhere.
  await page.goto("/");
  await page.getByRole("heading", { name, exact: true, level: 3 }).click();
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible({ timeout: 15_000 });
}

/** Import one recipe through the real AI paste path, without opening it. */
async function importRecipe(name: string): Promise<void> {
  const ai = stack!.ai;

  ai.control.reset();
  ai.control.enqueue({ kind: "success", content: JSON.stringify(linkableRecipe(name)) });
  // Anything beyond the queued directives is a bug in the scenario, not silent
  // extra AI work: fail loudly rather than answering it.
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

/** Ask for a manual run from the actions menu, with the claim queued. */
async function runManualLinking(): Promise<void> {
  stack!.ai.control.succeedWith(LINKING_CLAIM);

  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Link Ingredients to Steps" }).click();
  await page.keyboard.press("Escape");
}

/** Poll the open recipe page until the assertion holds, reloading each attempt. */
async function eventuallyOnRecipe(assertion: () => Promise<void>): Promise<void> {
  await expect(async () => {
    await page.reload();
    await assertion();
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
}

async function createLinkedRecipe(name: string): Promise<void> {
  await setAutomaticEnrichment({});
  await importRecipe(name);
  await openRecipe(name);
  await runManualLinking();
  await eventuallyOnRecipe(async () => {
    await expect(page.getByText("25 milliliters water").first()).toBeVisible({ timeout: 3_000 });
  });
}

test("a manual run links an aggregate step and computes the fractional amount", async () => {
  await createLinkedRecipe("Linked Spice Stew");

  await eventuallyOnRecipe(async () => {
    // The aggregate case: "add the spices" carries every spice line, resolved
    // to names and amounts beneath the step. `.first()`: the section renders
    // in both the desktop and mobile layouts, one of which CSS hides.
    await expect(page.getByText("5 grams salt").first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("3 grams pepper").first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("2 grams paprika").first()).toBeVisible({ timeout: 3_000 });
    // The fractional case: half of 50 ml is written where the cook needs it.
    await expect(page.getByText("25 milliliters water").first()).toBeVisible({ timeout: 3_000 });
  });

  // Stored per measurement system, fanned out from one semantic inference by
  // ingredient line order; the untouched "Serve." step stays bare. The paste
  // import numbers step rows from 1 and ingredient lines from 0 — the join is
  // by value, so the base never matters, only consistency.
  const stored = await readStoredStepIngredients("Linked Spice Stew");
  const metric = stored.filter((row) => row.systemUsed === "metric");
  const us = stored.filter((row) => row.systemUsed === "us");

  expect(metric).toEqual([
    { systemUsed: "metric", stepOrder: 1, ingredientOrder: 0, share: 1 },
    { systemUsed: "metric", stepOrder: 1, ingredientOrder: 1, share: 1 },
    { systemUsed: "metric", stepOrder: 1, ingredientOrder: 2, share: 1 },
    { systemUsed: "metric", stepOrder: 2, ingredientOrder: 3, share: 0.5 },
  ]);
  expect(us).toEqual([
    { systemUsed: "us", stepOrder: 1, ingredientOrder: 0, share: 1 },
    { systemUsed: "us", stepOrder: 1, ingredientOrder: 1, share: 1 },
    { systemUsed: "us", stepOrder: 1, ingredientOrder: 2, share: 1 },
    { systemUsed: "us", stepOrder: 2, ingredientOrder: 3, share: 0.5 },
  ]);
});

test("cooking mode presents the active step's ingredients with resolved amounts", async () => {
  await createLinkedRecipe("Cooking Mode Linked Stew");

  await page.getByRole("button", { name: "Cook", exact: true }).first().click();

  // Step 1 is the aggregate: its three lines are in front of the cook.
  await expect(page.getByRole("dialog").getByText("5 grams salt").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("dialog").getByText("2 grams paprika").first()).toBeVisible();

  await page.keyboard.press("Escape");
});

test("a share-link recipient sees the same amounts beneath steps", async () => {
  await createLinkedRecipe("Shared Linked Stew");

  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Share" }).click();
  await page.getByRole("button", { name: "Create link" }).click();

  // The freshly created link is shown in a read-only field beside Copy/Open.
  const urlField = page.getByRole("textbox").last();

  await expect(urlField).toBeVisible({ timeout: 15_000 });

  const shareUrl = await urlField.inputValue();

  expect(shareUrl).toContain("/share/");

  // A fresh, unauthenticated context: the recipient has no session.
  const anonymous = await context.browser()!.newContext({ baseURL: stack.baseURL });
  const shared = await anonymous.newPage();

  await shared.goto(shareUrl!);
  await expect(shared.getByText("25 milliliters water").first()).toBeVisible({ timeout: 15_000 });
  await expect(shared.getByText("5 grams salt").first()).toBeVisible();
  await anonymous.close();
});

test("attaching from the picker asks for the amount, and Escape keeps the whole line", async () => {
  const recipeName = "Editor Linked Stew";

  await createLinkedRecipe(recipeName);

  const recipeId = new URL(page.url()).pathname.split("/").pop();

  await page.goto(`/recipes/edit/${recipeId}`);

  const instructions = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Instructions" }) });

  // The bare "Serve." step is the third row; give it the salt line. Its own
  // chips list scopes the assertions — the spices step carries bare-name
  // chips of the same lines.
  await expect(instructions.getByRole("textbox").nth(2)).toHaveValue("Serve.", {
    timeout: 30_000,
  });

  const serveChips = instructions.getByRole("list", { name: "Linked ingredients" }).nth(2);

  await instructions.getByRole("button", { name: "Link ingredient" }).nth(2).click();
  await page.getByRole("menuitem", { name: "salt", exact: true }).click();

  // The ask: focused over the fresh chip — the picker menu's own focus
  // restore must not win — and prefilled with the whole line.
  const ask = page.getByRole("spinbutton", { name: "Amount" });

  await expect(ask).toBeFocused({ timeout: 15_000 });
  await expect(ask).toHaveValue("5");

  // Half the salt, typed as its amount. The chip shows the derived amount
  // with the line's stored unit — the import stores "grams" long-form.
  await ask.fill("2.5");
  await ask.press("Enter");
  await expect(serveChips.getByText("2.5 grams salt")).toBeVisible();
  // The keyboard lands back in the step's text.
  await expect(instructions.getByRole("textbox").nth(2)).toBeFocused();

  // Escape after typing keeps the whole line: the abandoned 9 never lands.
  await instructions.getByRole("button", { name: "Link ingredient" }).nth(2).click();
  await page.getByRole("menuitem", { name: "pepper", exact: true }).click();
  await expect(ask).toBeFocused({ timeout: 15_000 });
  await ask.fill("9");
  await ask.press("Escape");
  await expect(serveChips.getByText("9 grams pepper")).not.toBeVisible();
  await expect(serveChips.getByText("pepper", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/, { timeout: 30_000 });

  // Stored as shares of the line: 2.5 of the 5 g salt is 0.5; the escaped
  // pepper stays the whole line. The editor's save rewrites the active
  // system's steps positionally from 0, so "Serve." is stepOrder 2 now —
  // the import's 1-based numbering survives only on the untouched system.
  await expect
    .poll(
      async () =>
        (await readStoredStepIngredients(recipeName)).filter(
          (row) => row.systemUsed === "metric" && row.stepOrder === 2
        ),
      { timeout: 30_000, intervals: [250, 500, 1_000] }
    )
    .toEqual([
      { systemUsed: "metric", stepOrder: 2, ingredientOrder: 0, share: 0.5 },
      { systemUsed: "metric", stepOrder: 2, ingredientOrder: 1, share: 1 },
    ]);
});

test("gap-filling leaves a hand-attached chip untouched while bare steps are filled", async () => {
  await setAutomaticEnrichment({});

  await importRecipe("Hand Linked Stew");

  // An editor attached paprika to the aggregate step by hand — the active
  // system's step, exactly as the editor's chips row would.
  await supplyStepIngredient("Hand Linked Stew", {
    systemUsed: "metric",
    stepOrder: 1,
    ingredientOrder: 2,
    share: 1,
  });

  await openRecipe("Hand Linked Stew");
  await runManualLinking();

  await eventuallyOnRecipe(async () => {
    // The bare "half the water" step was filled.
    await expect(page.getByText("25 milliliters water").first()).toBeVisible({ timeout: 3_000 });
  });

  const stored = await readStoredStepIngredients("Hand Linked Stew");
  const metricAggregate = stored.filter(
    (row) => row.systemUsed === "metric" && row.stepOrder === 1
  );

  // The hand-attached chip is exactly as the editor left it — one link, not
  // the model's three: the step already had Step Ingredients, so the run was
  // simply not its business.
  expect(metricAggregate).toEqual([
    { systemUsed: "metric", stepOrder: 1, ingredientOrder: 2, share: 1 },
  ]);
  // The bare steps were filled in both systems, including the us aggregate,
  // whose counterpart chip exists only on the metric side.
  expect(stored.filter((row) => row.systemUsed === "metric" && row.stepOrder === 2)).toHaveLength(
    1
  );
  expect(stored.filter((row) => row.systemUsed === "us" && row.stepOrder === 1)).toHaveLength(3);
});
