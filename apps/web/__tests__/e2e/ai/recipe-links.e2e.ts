/**
 * Recipe cards are real links (#555): a modified or middle click opens the recipe in a new tab,
 * a plain click still navigates in place, and the card's own buttons never navigate.
 */
import type { BrowserContext, Locator, Page } from "@playwright/test";

import { planForTonight, removePlans } from "../harness/plans";
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
  // The card is focusable only while its row is swiped open.
  await card.getByLabel("Recipe options").click();
  await expect(card).toHaveAttribute("tabindex", "0");
  await expect(page.getByRole("button", { name: "Add to calendar" }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  // A title click while the row still slides shut retries into a scroll that puts it under the nav.
  await card.getByLabel("Recipe options").click();
  await expect(card).toHaveAttribute("tabindex", "-1");

  await title.click();
  await expect(page).toHaveURL(recipeUrl);
  expect(context.pages()).toHaveLength(1);
});

test("a planned recipe in Today is a link to it", async ({ aiStack, context, page }) => {
  const name = `Tonight's Linked Stew ${Date.now()}`;
  const id = await seedRecipe(name);
  const recipeUrl = new RegExp(`/recipes/${id}`);

  try {
    await planForTonight(aiStack.baseURL, aiStack.ownerCookies, id);
    await page.goto("/");
    const slot = page.locator('[data-slot-card="Dinner"]').getByRole("link", { name });

    await expect(slot).toHaveAttribute("href", recipeUrl);
    await expectNewTab(context, slot, { button: "middle" }, recipeUrl);

    await slot.click();
    await expect(page).toHaveURL(recipeUrl);
  } finally {
    await removePlans(aiStack.baseURL, aiStack.ownerCookies, (plan) => plan.recipeId === id);
  }
});
