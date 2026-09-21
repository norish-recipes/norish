/**
 * The Pantry, in a browser.
 *
 * What a household member actually does: opens the Pantry from the groceries
 * page and types what is at home; is refused a name already there; adds a
 * recipe to the groceries and sees what the Pantry holds shown apart and off
 * the list; ticks one of those lines to add it anyway; takes a name out of
 * the Pantry and sees the recipe's line become one to buy again. The real Norish
 * server, database, Redis, tRPC and realtime are all in the path; nothing
 * outbound is.
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixture";
import {
  readGroceryNames,
  readPantryNames,
  resetPantryScenario,
  seedRecipeWithIngredients,
} from "./pantry-support";

test.describe.configure({ mode: "serial" });

const RECIPE = "Pantry chicken";

let page: Page;
let recipeId: string;

test.beforeAll(async ({ browser, aiStack }) => {
  await resetPantryScenario();
  recipeId = await seedRecipeWithIngredients(RECIPE, ["olive oil", "chicken breast"]);

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
async function openPantry(): Promise<ReturnType<Page["getByRole"]>> {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "View Mode" }).click();
  await page.getByRole("menuitem", { name: "Pantry" }).click();

  const panel = page.getByRole("dialog", { name: "Pantry" });

  await expect(panel).toBeVisible();

  return panel;
}

/**
 * Tick or untick a line by pressing its visible control: the checkbox's input
 * sits behind the control, which is what takes the pointer.
 */
async function tick(panel: ReturnType<Page["getByRole"]>, name: string): Promise<void> {
  await panel
    .getByRole("checkbox", { name })
    .locator("xpath=ancestor::*[@data-slot='checkbox'][1]")
    .click();
}

/** The recipe's add-to-groceries panel, opened from its ingredients card. */
async function openAddToGroceries(): Promise<ReturnType<Page["getByRole"]>> {
  await page.goto(`/recipes/${recipeId}`);
  await page.getByRole("button", { name: "Add", exact: true }).first().click();

  const panel = page.getByRole("dialog", { name: "Add to Groceries" });

  await expect(panel).toBeVisible();
  await expect(panel.getByRole("checkbox", { name: "chicken breast" })).toBeVisible();

  return panel;
}

test("a name typed into the Pantry is kept, folded, and refused a second time", async () => {
  const panel = await openPantry();

  await expect(panel.getByTestId("pantry-empty")).toBeVisible();
  await panel.getByTestId("pantry-name").fill("Olive Oil");
  await panel.getByTestId("pantry-name").press("Enter");
  await expect(panel.locator('[data-pantry-ingredient="olive oil"]')).toHaveText("Olive Oil");
  await expect.poll(readPantryNames).toEqual(["olive oil"]);

  await panel.getByTestId("pantry-name").fill(" olive  oil! ");
  await expect(panel.getByTestId("pantry-duplicate")).toBeVisible();
  await expect(panel.getByTestId("add-pantry-ingredient")).toBeDisabled();
  await panel.getByTestId("pantry-name").press("Enter");
  await expect.poll(readPantryNames).toEqual(["olive oil"]);
});

test("an ingredient in the Pantry is shown apart and left off the list", async () => {
  const panel = await openAddToGroceries();
  const held = panel.getByTestId("pantry-section");

  await expect(held).toContainText("In your pantry");
  await expect(held.getByRole("checkbox", { name: "olive oil" })).not.toBeChecked();
  await expect(panel.getByRole("checkbox", { name: "chicken breast" })).toBeChecked();
  await expect(panel.getByText("1 of 1 selected")).toBeVisible();

  await panel.getByRole("button", { name: "Add", exact: true }).click();
  await expect(panel).toBeHidden();
  await expect.poll(readGroceryNames).toEqual(["chicken breast"]);
});

test("an ingredient in the Pantry, ticked, is added anyway", async () => {
  const panel = await openAddToGroceries();

  await tick(panel, "chicken breast");
  await tick(panel, "olive oil");
  await expect(panel.getByRole("checkbox", { name: "chicken breast" })).not.toBeChecked();
  await expect(panel.getByRole("checkbox", { name: "olive oil" })).toBeChecked();
  await panel.getByRole("button", { name: "Add", exact: true }).click();
  await expect(panel).toBeHidden();
  await expect.poll(readGroceryNames).toEqual(["chicken breast", "olive oil"]);
});

test("a name taken out of the Pantry is one to buy again", async () => {
  const panel = await openPantry();

  await panel
    .locator('[data-pantry-ingredient="olive oil"]')
    .getByRole("button", { name: "Remove from pantry" })
    .click();
  await expect(panel.getByTestId("pantry-empty")).toBeVisible();
  await expect.poll(readPantryNames).toEqual([]);

  const groceries = await openAddToGroceries();

  await expect(groceries.getByTestId("pantry-section")).toHaveCount(0);
  await expect(groceries.getByRole("checkbox", { name: "olive oil" })).toBeChecked();
  await expect(groceries.getByText("2 of 2 selected")).toBeVisible();
});
