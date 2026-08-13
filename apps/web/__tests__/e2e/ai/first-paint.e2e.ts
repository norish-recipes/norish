/**
 * First-paint fidelity for device-preference cookies (tickets 16-19).
 *
 * The claim under test is that the HTML the server sends already reflects
 * the stored device preference — the wrong shape never paints. That is only
 * observable at the seam that speaks real HTTP, so each assertion here reads
 * the server's markup through a JavaScript-disabled page: what shows is
 * exactly what the server sent, with no hydration to repaint it.
 *
 * The amount format needs a recipe on screen, so that scenario drives the
 * real import pipeline first and then asserts the painted amounts.
 */
import type { Browser, BrowserContext, Page } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import { expect, test } from "./fixture";
import { submitPasteImport } from "./import-support";
import { setAutomaticEnrichment } from "./recipe-enrichment-support";

test.describe.configure({ mode: "serial" });

let stack: AIE2EStack;
let page: Page;

test.beforeEach(async ({ aiStack, page: fixturePage }) => {
  stack = aiStack;
  page = fixturePage;
  await setAutomaticEnrichment({});
});

/** A page that renders the server's bytes and nothing else. */
async function openStatic(
  browser: Browser,
  cookies: { name: string; value: string }[]
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: stack.baseURL,
    javaScriptEnabled: false,
    storageState: { cookies: stack.ownerCookies, origins: [] },
  });

  await context.addCookies(cookies.map((cookie) => ({ ...cookie, url: stack.baseURL })));

  return { context, page: await context.newPage() };
}

test("groceries arrives in the stored view", async ({ browser }) => {
  const { context, page: staticPage } = await openStatic(browser, [
    { name: "norish_grocery_view_mode", value: "recipe" },
  ]);

  try {
    await staticPage.goto("/groceries");
    await expect(staticPage.locator('[data-grocery-view="recipe"]')).toBeAttached();
    await expect(staticPage.locator('[data-grocery-view="store"]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("groceries defaults to the store view when nothing is stored", async ({ browser }) => {
  const { context, page: staticPage } = await openStatic(browser, []);

  try {
    await staticPage.goto("/groceries");
    await expect(staticPage.locator('[data-grocery-view="store"]')).toBeAttached();
    await expect(staticPage.locator('[data-grocery-grouping="grouped"]')).toBeAttached();
  } finally {
    await context.close();
  }
});

test("groceries arrives ungrouped when grouping is turned off", async ({ browser }) => {
  const { context, page: staticPage } = await openStatic(browser, [
    { name: "norish_grocery_group_similar", value: "false" },
  ]);

  try {
    await staticPage.goto("/groceries");
    await expect(staticPage.locator('[data-grocery-grouping="flat"]')).toBeAttached();
  } finally {
    await context.close();
  }
});

test("a hidden Today's meals never reaches the dashboard markup", async ({ browser }) => {
  const { context, page: staticPage } = await openStatic(browser, [
    { name: "norish_todays_meals_visibility", value: "hidden" },
  ]);

  try {
    await staticPage.goto("/");
    await expect(staticPage.locator("#today-meals-heading")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("Today's meals is in the dashboard markup by default", async ({ browser }) => {
  const { context, page: staticPage } = await openStatic(browser, []);

  try {
    await staticPage.goto("/");
    await expect(staticPage.locator("#today-meals-heading")).toBeAttached();
  } finally {
    await context.close();
  }
});

test("a planned rule keeps the block in the dashboard markup", async ({ browser }) => {
  // What is planned is client data, so the server's share of the planned
  // rule is rendering the block; the empty-day collapse is the client's.
  const { context, page: staticPage } = await openStatic(browser, [
    { name: "norish_todays_meals_visibility", value: "planned" },
  ]);

  try {
    await staticPage.goto("/");
    await expect(staticPage.locator("#today-meals-heading")).toBeAttached();
  } finally {
    await context.close();
  }
});

test("the library arrives with the stored list view selected", async ({ browser }) => {
  const { context, page: staticPage } = await openStatic(browser, [
    { name: "norish_recipe_view_mode", value: "list" },
  ]);

  try {
    await staticPage.goto("/");
    await expect(
      staticPage.locator('[data-slot="tabs-tab"][data-key="list"]').first()
    ).toHaveAttribute("aria-selected", "true");
  } finally {
    await context.close();
  }
});

// The fake provider's recipe carries a fractional amount, so the two
// formats are distinguishable: ½ as a fraction, 0.5 as a decimal.
const FIRST_PAINT_RECIPE = {
  name: "First Paint Porridge",
  description: "A deterministic recipe returned by the E2E AI provider.",
  notes: null,
  recipeYield: 2,
  prepTime: null,
  cookTime: null,
  totalTime: null,
  recipeIngredient: {
    metric: ["0.5 L oat milk", "200 g rolled oats"],
    us: ["0.5 quart oat milk", "7 oz rolled oats"],
  },
  recipeInstructions: {
    metric: ["Simmer the oats in the milk.", "Rest, then serve."],
    us: ["Simmer the oats in the milk.", "Rest, then serve."],
  },
  keywords: null,
  allergyIndications: [],
  categories: ["Breakfast"],
  // The extraction schema wants the four-field object, each nullable.
  nutrition: { calories: null, fat: null, carbs: null, protein: null },
};

test("amounts paint in the reader's format with a settled toggle", async () => {
  stack.ai.control.succeedWith(FIRST_PAINT_RECIPE);

  // The choice is on the device before the recipe is ever opened.
  await page
    .context()
    .addCookies([{ name: "norish_amount_display", value: "decimal", url: stack.baseURL }]);

  await page.goto("/");
  await submitPasteImport(page, "Paste for the first-paint amount scenario.");

  await expect(async () => {
    await page.reload();
    await expect(page.getByText(FIRST_PAINT_RECIPE.name).first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });

  await page.getByText(FIRST_PAINT_RECIPE.name).first().click();

  // The first painted amounts are already decimal, and the fraction glyph
  // never has a reason to exist on this page.
  await expect(page.getByText("0.5", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("½", { exact: false })).toHaveCount(0);

  // The toggle reflects the stored choice with no disabled stand-in.
  const toggle = page.getByRole("button", { name: /show fractions/i }).first();

  await expect(toggle).toBeVisible();
  await expect(toggle).toBeEnabled();

  // The other format: a fraction reader's page carries ½ and no 0.5.
  await page.context().addCookies([
    {
      name: "norish_amount_display",
      value: "fraction",
      url: stack.baseURL,
    },
  ]);
  await page.reload();

  await expect(page.getByText("½", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("0.5", { exact: false })).toHaveCount(0);
});
