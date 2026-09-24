/**
 * Capture the documentation screenshots for the Pantry against a recipe the
 * harness seeds itself, so the pictures in the docs show the real app and
 * nothing outbound is involved.
 *
 * Not part of the gate. To re-capture: copy this file into
 * `apps/web/__tests__/e2e/ai/`, build (`rm -rf apps/web/.next && pnpm build:web
 * && pnpm build:server`), run `DOCS_SHOTS=1 pnpm exec playwright test --config
 * __tests__/e2e/playwright.config.ts --project=ai
 * __tests__/e2e/ai/docs-screenshots.e2e.ts` from `apps/web`, and delete the
 * copy again. Never run it in the same Playwright invocation as the grocery
 * scenarios: they share the worker's stack and database. Without DOCS_SHOTS
 * the pictures land in SHOTS_DIR only.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixture";
import { seedRecipeWithIngredients } from "./pantry-support";

test.describe.configure({ mode: "serial" });

const SHOTS = process.env.SHOTS_DIR ?? path.resolve(import.meta.dirname, "../.runtime/shots");
const TAG = process.env.SHOTS_TAG ?? "pantry";
const DOCS = process.env.DOCS_SHOTS
  ? path.resolve(import.meta.dirname, "../../../../../apps/docs/static/img/screenshots")
  : null;

let page: Page;
let recipeId: string;

test.beforeAll(async ({ browser, aiStack }) => {
  mkdirSync(SHOTS, { recursive: true });
  recipeId = await seedRecipeWithIngredients("Roast chicken with lemon", [
    "whole chicken",
    "lemon",
    "olive oil",
    "garlic",
    "salt",
    "black pepper",
  ]);

  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
    viewport: { width: 1100, height: 820 },
    deviceScaleFactor: 1.5,
    reducedMotion: "reduce",
  });

  page = await context.newPage();
});

test.afterAll(async () => {
  await page?.context().close();
});

/** A working picture, and the documentation's copy of it where it has one. */
async function snap(name: string, docsName?: string, fullPage = false): Promise<void> {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `${TAG}-${name}.png`), fullPage });
  if (DOCS && docsName) await page.screenshot({ path: path.join(DOCS, docsName), fullPage });
}

test("captures the Pantry panel with a few names in it", async () => {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).waitFor();
  await page.getByRole("button", { name: "View Mode" }).click();
  await page.getByRole("menuitem", { name: "Pantry" }).click();

  const panel = page.getByRole("dialog", { name: "Pantry" });

  await expect(panel).toBeVisible();
  for (const name of ["Olive oil", "Salt", "Black pepper", "Flour", "Garlic"]) {
    await panel.getByTestId("pantry-name").fill(name);
    await panel.getByTestId("pantry-name").press("Enter");
    await expect(panel.getByText(name, { exact: true })).toBeVisible();
  }
  await snap("panel", "groceries-pantry-panel.png");
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("captures the add-to-groceries panel with the Pantry's lines apart", async () => {
  await page.goto(`/recipes/${recipeId}`);
  await page.getByRole("button", { name: "Add", exact: true }).first().click();

  const panel = page.getByRole("dialog", { name: "Add to Groceries" });

  await expect(panel.getByTestId("pantry-section")).toBeVisible();
  await snap("section", "groceries-pantry-section.png");
  await page.keyboard.press("Escape");
});
