/**
 * Recipe cards are real links (#555): a modified or middle click opens the recipe in a new tab,
 * a plain click still navigates in place, and the card's own buttons never navigate.
 */
import type { BrowserContext, Locator, Page } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import { callTrpc } from "../harness/trpc";
import { seedRecipe } from "./cookbooks-support";
import { expect, test } from "./fixture";

/** Clicking the target the given way opens `url` in a new tab, which is closed again. */
async function expectNewTab(
  context: BrowserContext,
  target: Locator,
  how: Parameters<Locator["click"]>[0],
  url: RegExp
): Promise<void> {
  const [tab] = await Promise.all([context.waitForEvent("page"), target.click(how)]);

  await expect(tab).toHaveURL(url);
  await tab.close();
}

/** Plans the recipe as the owner's dinner today, in the browser's own calendar. */
async function planForTonight(stack: AIE2EStack, recipeId: string): Promise<void> {
  await callTrpc(stack.baseURL, stack.ownerCookies, "calendar.createItem", {
    date: new Date().toLocaleDateString("en-CA"),
    slot: "Dinner",
    itemType: "recipe",
    recipeId,
  });
}

function libraryCard(page: Page, name: string): Locator {
  return page.locator("[data-recipe-card]").filter({ hasText: name });
}

test("a library card opens its recipe in a new tab and still navigates on a plain click", async ({
  context,
  page,
}) => {
  const name = `Linked Stew ${Date.now()}`;
  const id = await seedRecipe(name);
  const recipeUrl = new RegExp(`/recipes/${id}`);

  await page.goto("/");
  const card = libraryCard(page, name);
  const title = card.locator("h3");

  await expect(card).toHaveAttribute("href", recipeUrl);
  await expectNewTab(context, title, { modifiers: ["ControlOrMeta"] }, recipeUrl);
  await expectNewTab(context, title, { button: "middle" }, recipeUrl);
  await expect(page).toHaveURL(/\/$/);

  // The options button opens the card's actions and leaves the reader on the Library.
  await card.getByLabel("Recipe options").click();
  await expect(page.getByRole("button", { name: "Add to calendar" }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await card.getByLabel("Recipe options").click();

  await title.click();
  await expect(page).toHaveURL(recipeUrl);
  expect(context.pages()).toHaveLength(1);
});

test("a planned recipe in Today is a link to it", async ({ aiStack, context, page }) => {
  const name = `Tonight's Linked Stew ${Date.now()}`;
  const id = await seedRecipe(name);
  const recipeUrl = new RegExp(`/recipes/${id}`);

  await planForTonight(aiStack, id);
  await page.goto("/");
  const slot = page.locator('[data-slot-card="Dinner"]').getByRole("link", { name });

  await expect(slot).toHaveAttribute("href", recipeUrl);
  await expectNewTab(context, slot, { button: "middle" }, recipeUrl);

  await slot.click();
  await expect(page).toHaveURL(recipeUrl);
});
