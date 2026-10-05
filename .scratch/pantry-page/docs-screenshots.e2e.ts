/**
 * Capture the documentation screenshots for the Pantry page against recipes
 * the harness seeds itself, so the pictures in the docs show the real app
 * and nothing outbound is involved.
 *
 * Not part of the gate. To re-capture: copy this file into
 * `apps/web/__tests__/e2e/ai/`, build from the repo root (`rm -rf
 * apps/web/.next && pnpm build:web && pnpm build:server`), run `DOCS_SHOTS=1
 * npx playwright test -c __tests__/e2e/playwright.config.ts --project=ai
 * __tests__/e2e/ai/docs-screenshots.e2e.ts` from `apps/web`, and delete the
 * copy again. Never run it in the same Playwright invocation as the grocery
 * scenarios: they share the worker's stack and database. Without DOCS_SHOTS
 * the pictures land in SHOTS_DIR only.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixture";
import { resetPantryScenario, seedRecipeWithIngredients, seedStorePreference } from "./pantry-support";

test.describe.configure({ mode: "serial" });

const SHOTS = process.env.SHOTS_DIR ?? path.resolve(import.meta.dirname, "../.runtime/shots");
const DOCS = process.env.DOCS_SHOTS
  ? path.resolve(import.meta.dirname, "../../../../../apps/docs/static/img/screenshots")
  : null;

let page: Page;
let recipeId: string;

test.beforeAll(async ({ browser, aiStack }) => {
  mkdirSync(SHOTS, { recursive: true });
  await resetPantryScenario();
  recipeId = await seedRecipeWithIngredients("Roast chicken with lemon", [
    "whole chicken",
    "lemon",
    "olive oil",
    "garlic",
    "salt",
    "black pepper",
  ]);
  await seedRecipeWithIngredients("Spaghetti aglio e olio", [
    "spaghetti",
    "olive oil",
    "garlic",
    "salt",
    "black pepper",
  ]);
  await seedRecipeWithIngredients("Lentil soup", ["lentils", "onion", "olive oil", "salt"]);
  await seedStorePreference("Market", "olive oil");

  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
    viewport: { width: 1100, height: 820 },
    deviceScaleFactor: 1.5,
    reducedMotion: "reduce",
  });

  context.setDefaultTimeout(15_000);
  page = await context.newPage();
});

test.afterAll(async () => {
  await page?.context().close();
});

/** A working picture, and the documentation's copy of it. */
async function snap(name: string): Promise<void> {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, name) });
  if (DOCS) await page.screenshot({ path: path.join(DOCS, name) });
}

test("captures From your recipes on an empty Pantry", async () => {
  await page.goto("/groceries/pantry");
  await expect(page.locator('[data-pantry-suggestion="olive oil"]')).toBeVisible();
  await snap("groceries-pantry-suggestions.png");
});

test("captures the Pantry with a food on the list", async () => {
  for (const name of ["olive oil", "salt", "garlic", "black pepper"]) {
    await page.getByRole("button", { name: `Add ${name} to your pantry` }).click();
    await expect(page.locator(`[data-pantry-ingredient="${name}"]`)).toBeVisible();
  }
  await page
    .locator('[data-pantry-ingredient="olive oil"]')
    .getByRole("button", { name: "Put on the list" })
    .click();
  await expect(page.getByTestId("on-the-list")).toBeVisible();
  // The suggestions stay open as left; fold them so the page shows what is kept.
  await page.getByRole("button", { name: "From your recipes" }).click();
  await page.waitForTimeout(5_500);
  await snap("groceries-pantry-page.png");
});

test("captures the Ingredient panel's Pantry row", async () => {
  await page.getByRole("button", { name: "garlic", exact: true }).click();
  await expect(page.getByTestId("ingredient-pantry")).toBeVisible();
  await snap("groceries-pantry-ingredient-panel.png");
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("captures We keep this while adding a recipe", async () => {
  await page.goto(`/recipes/${recipeId}`);
  await page.getByRole("button", { name: "Add", exact: true }).first().click();

  const panel = page.getByRole("dialog", { name: "Add to Groceries" });

  await expect(panel.getByTestId("pantry-section")).toBeVisible();
  await snap("groceries-pantry-we-keep-this.png");
});
