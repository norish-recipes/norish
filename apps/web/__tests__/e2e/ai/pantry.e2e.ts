/**
 * The Pantry page, in a browser.
 *
 * What a household member actually does: switches from the grocery list to
 * the Pantry, fills an empty one from the foods their recipes use, narrows
 * it, adds a catalogue food and a typed one; puts a kept food on the list,
 * sees it marked, and ticks it off in the shop; stops keeping a food from its
 * Ingredient panel; and, adding a recipe, teaches the Pantry a staple with
 * We keep this. The real Norish server, database, Redis, tRPC and realtime
 * are all in the path; nothing outbound is.
 */
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixture";
import {
  readGroceries,
  readPantryNames,
  resetPantryScenario,
  seedRecipeWithIngredients,
  seedStorePreference,
} from "./pantry-support";

test.describe.configure({ mode: "serial" });

const RECIPE = "Pantry chicken";
const STORE = "Pantry Shop";

let page: Page;
let recipeId: string;
let storeId: string;

test.beforeAll(async ({ browser, aiStack }) => {
  await resetPantryScenario();
  recipeId = await seedRecipeWithIngredients(RECIPE, ["olive oil", "chicken breast"]);
  await seedRecipeWithIngredients("Pantry pasta", ["olive oil", "garlic", "# For the sauce"]);
  storeId = await seedStorePreference(STORE, "olive oil");

  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
  });

  page = await context.newPage();
});

test.afterAll(async () => {
  await page?.context().close();
});

/** A kept food's row on the Pantry page. */
function keptRow(name: string): Locator {
  return page.locator(`[data-pantry-ingredient="${name}"]`);
}

/** A food offered under "From your recipes". */
function suggestion(name: string): Locator {
  return page.locator(`[data-pantry-suggestion="${name}"]`);
}

/** The Pantry page, reached the way a member reaches it: from the list's switch. */
async function openPantry(): Promise<void> {
  await page.goto("/groceries");
  await page.getByRole("tab", { name: "Pantry" }).click();
  await expect(page).toHaveURL(/\/groceries\/pantry$/);
}

/** The recipe's add-to-groceries panel, opened from its ingredients card. */
async function openAddToGroceries(): Promise<Locator> {
  await page.goto(`/recipes/${recipeId}`);
  await page.getByRole("button", { name: "Add", exact: true }).first().click();

  const panel = page.getByRole("dialog", { name: "Add to Groceries" });

  await expect(panel).toBeVisible();
  await expect(panel.getByRole("checkbox", { name: "chicken breast" })).toBeVisible();

  return panel;
}

test("an empty Pantry offers the foods the household's recipes use, with their counts", async () => {
  await openPantry();

  await expect(page.getByTestId("pantry-empty")).toBeVisible();
  await expect(suggestion("olive oil")).toContainText("in 2 recipes");
  await expect(suggestion("garlic")).toContainText("in 1 recipe");
  await expect(suggestion("chicken breast")).toContainText("in 1 recipe");
  // A heading names no food, so it is never offered.
  await expect(page.locator("[data-pantry-suggestion]")).toHaveCount(3);
});

test("a suggestion added is kept, and leaves the suggestions", async () => {
  await suggestion("olive oil")
    .getByRole("button", { name: "Add olive oil to your pantry" })
    .click();

  await expect(keptRow("olive oil")).toBeVisible();
  await expect(suggestion("olive oil")).toHaveCount(0);
  await expect.poll(readPantryNames).toEqual(["olive oil"]);
});

test("the field narrows the kept foods, adds a catalogue food as picked, and adds typed text", async () => {
  const field = page.getByTestId("pantry-name");

  await field.fill("gar");
  await expect(page.getByTestId("pantry-no-match")).toBeVisible();
  const match = page.locator('[data-catalogue-food="garlic"]');

  await match.getByRole("button", { name: "Add garlic to your pantry" }).click();
  await expect(keptRow("garlic")).toBeVisible();
  await expect(field).toHaveValue("");
  await expect(field).toBeFocused();

  await field.fill("oli");
  await expect(keptRow("olive oil")).toBeVisible();
  await expect(keptRow("garlic")).toHaveCount(0);
  // A food already kept is never offered as one to add.
  await expect(page.locator('[data-catalogue-food="olive oil"]')).toHaveCount(0);

  await field.fill("saffron");
  await field.press("Enter");
  await expect(keptRow("saffron")).toBeVisible();
  await expect.poll(readPantryNames).toEqual(["garlic", "olive oil", "saffron"]);

  // A food already kept is simply what the field narrows to; Enter adds nothing.
  await field.fill("Garlic");
  await field.press("Enter");
  await expect(keptRow("garlic")).toBeVisible();
  await expect.poll(readPantryNames).toEqual(["garlic", "olive oil", "saffron"]);
  await field.fill("");
});

test("Put on the list files a grocery under its Store, and ticking it off is the restock", async () => {
  await keptRow("olive oil").getByRole("button", { name: "Add to groceries" }).click();

  await expect(keptRow("olive oil").getByTestId("on-the-list")).toBeVisible();
  await expect.poll(readGroceries).toEqual([{ name: "olive oil", storeId, isDone: false }]);

  await page.getByRole("tab", { name: "List" }).click();
  await expect(page).toHaveURL(/\/groceries$/);
  await page
    .locator('[data-grocery-name="olive oil"]')
    .first()
    .locator('[data-slot="checkbox"]')
    .first()
    .click();
  await expect.poll(readGroceries).toEqual([{ name: "olive oil", storeId, isDone: true }]);

  await page.getByRole("tab", { name: "Pantry" }).click();
  await expect(
    keptRow("olive oil").getByRole("button", { name: "Add to groceries" })
  ).toBeVisible();
});

test("a kept food's Ingredient panel takes it out of the Pantry with Save", async () => {
  await keptRow("saffron").getByRole("button", { name: "saffron" }).click();

  const panel = page.getByRole("dialog", { name: "saffron" });
  const kept = panel.getByRole("switch", { name: "In your pantry" });

  await expect(kept).toBeChecked();
  // The switch's input sits behind its control; the label is what takes the press.
  await panel.getByText("In your pantry", { exact: true }).click();
  await expect(kept).not.toBeChecked();
  // The switch is part of the panel's draft: nothing changes until Save.
  await expect.poll(readPantryNames).toEqual(["garlic", "olive oil", "saffron"]);
  await panel.getByTestId("ingredient-save").click();
  await expect.poll(readPantryNames).toEqual(["garlic", "olive oil"]);
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(keptRow("saffron")).toHaveCount(0);
});

test("adding a recipe teaches the Pantry a staple, and a kept line on the list says so", async () => {
  await openPantry();
  await keptRow("olive oil").getByRole("button", { name: "Add to groceries" }).click();
  await expect(keptRow("olive oil").getByTestId("on-the-list")).toBeVisible();

  const panel = await openAddToGroceries();
  const held = panel.getByTestId("pantry-section");

  await expect(held.getByTestId("on-the-list")).toHaveCount(1);

  await panel.getByRole("button", { name: "We keep this", exact: true }).click();
  await expect(held.getByRole("checkbox", { name: "chicken breast" })).not.toBeChecked();
  await expect(panel.getByTestId("to-buy-section")).toHaveCount(0);
  await expect.poll(readPantryNames).toEqual(["chicken breast", "garlic", "olive oil"]);
});
