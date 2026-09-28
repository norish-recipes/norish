/**
 * The ingredient catalogue, in a browser.
 *
 * What a household actually sees: a Dutch "ui" put in the Pantry leaves an
 * English recipe's "onion" off the list, because both are spellings of one
 * Ingredient; a food Norish was not sure about is marked on the Ingredients
 * page; and merging it into the food that holds an Aisle Link files its
 * grocery in that aisle. The scenario seeds a small catalogue of its own
 * rather than fetching Open Food Facts. The real Norish server, database,
 * Redis, tRPC and realtime are all in the path; nothing outbound is.
 */
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixture";
import {
  readIngredientOf,
  resetCatalogueScenario,
  seedCatalogue,
  seedStoreFiling,
  setParent,
} from "./ingredient-catalogue-support";
import { readGroceryNames, readPantryNames, seedRecipeWithIngredients } from "./pantry-support";

test.describe.configure({ mode: "serial" });

const RECIPE = "Onion soup";
const STORE = "Groenteboer";
const AISLE = "Groente";

let page: Page;
let recipeId: string;

test.beforeAll(async ({ browser, aiStack }) => {
  await resetCatalogueScenario();

  const ids = await seedCatalogue([
    {
      name: "onion",
      aliases: [
        { text: "onion", locale: "en" },
        { text: "onions", locale: "en" },
        { text: "ui", locale: "nl" },
      ],
    },
    { name: "uitjes", aliases: [{ text: "uitjes", locale: "nl" }], flagged: true },
    { name: "red onion", aliases: [{ text: "red onion", locale: "en" }] },
  ]);

  await setParent(ids["red onion"]!, ids.onion!);

  await seedStoreFiling(STORE, AISLE, ids.onion!);
  recipeId = await seedRecipeWithIngredients(RECIPE, ["onion", "butter"]);

  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
  });

  page = await context.newPage();
});

test.afterAll(async () => {
  await page?.context().close();
});

/** The Pantry panel, opened from the groceries page's menu. */
async function openPantry(): Promise<Locator> {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "View Mode" }).click();
  await page.getByRole("menuitem", { name: "Pantry" }).click();

  const panel = page.getByRole("dialog", { name: "Pantry" });

  await expect(panel).toBeVisible();

  return panel;
}

/** The Ingredients page's row for an Ingredient, by its own name. */
function ingredientRow(name: string): Locator {
  return page.locator(`[data-testid="ingredient-row"][data-ingredient="${name}"]`);
}

/** The Store's block on the grocery list. */
function storeBlock(): Locator {
  return page
    .locator("[data-store-id]")
    .filter({ has: page.locator("[data-store-drop-target]").filter({ hasText: STORE }) })
    .last();
}

/** The rows the Store files under an aisle. */
async function rowsIn(aisleName: string): Promise<string[]> {
  return storeBlock()
    .locator("[data-aisle-id]")
    .filter({ has: page.getByTestId("aisle-heading").filter({ hasText: aisleName }) })
    .locator("[data-grocery-name]")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-grocery-name") ?? ""));
}

test("a Dutch 'ui' in the Pantry leaves an English recipe's 'onion' off the list", async () => {
  const pantry = await openPantry();

  await pantry.getByTestId("pantry-name").fill("ui");
  await pantry.getByTestId("pantry-name").press("Enter");
  // "ui" is a spelling of onion: the Pantry holds the Ingredient, shown by its name.
  await expect(pantry.locator('[data-pantry-ingredient="onion"]')).toHaveText("onion");
  await expect.poll(readPantryNames).toEqual(["onion"]);

  await page.goto(`/recipes/${recipeId}`);
  await page.getByRole("button", { name: "Add", exact: true }).first().click();

  const panel = page.getByRole("dialog", { name: "Add to Groceries" });
  const held = panel.getByTestId("pantry-section");

  await expect(held.getByRole("checkbox", { name: "onion" })).not.toBeChecked();
  await expect(panel.getByRole("checkbox", { name: "butter" })).toBeChecked();
  await panel.getByRole("button", { name: "Add", exact: true }).click();
  await expect(panel).toBeHidden();
  await expect.poll(readGroceryNames).toEqual(["butter"]);
});

test("a food Norish was not sure about is marked on the Ingredients page", async () => {
  await page.goto("/settings?tab=ingredients");
  await page.getByTestId("ingredients-flagged-only").click();

  await expect(ingredientRow("uitjes").getByTestId("ingredient-flagged")).toBeVisible();
  await expect(ingredientRow("onion")).toHaveCount(0);
});

/** Add a grocery under the Store, through the panel a shopper uses. */
async function addGrocery(name: string): Promise<void> {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill(name);
  await page.getByRole("button", { name: /Auto-detect from history/ }).click();
  await page.getByRole("option", { name: STORE }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(storeBlock().locator(`[data-grocery-name="${name}"]`)).toBeVisible();
}

test("a kind of a food with no aisle of its own is filed in its parent's", async () => {
  await addGrocery("red onion");

  await expect.poll(() => rowsIn(AISLE)).toEqual(["red onion"]);
});

test("merging it into the food that holds an Aisle Link files its grocery in that aisle", async () => {
  await addGrocery("uitjes");
  await expect.poll(() => rowsIn(AISLE)).toEqual(["red onion"]);

  await page.goto("/settings?tab=ingredients");
  await ingredientRow("uitjes").getByTestId("ingredient-merge").click();
  await ingredientRow("uitjes").getByTestId("ingredient-picker").fill("onion");
  await page.getByRole("option", { name: "onion", exact: true }).click();
  await ingredientRow("uitjes").getByTestId("ingredient-relocation-confirm").click();
  await expect(ingredientRow("uitjes")).toHaveCount(0);
  await expect.poll(() => readIngredientOf("uitjes")).toBe("onion");

  await page.goto("/groceries");
  await expect.poll(async () => (await rowsIn(AISLE)).sort()).toEqual(["red onion", "uitjes"]);
});
