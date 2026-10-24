/**
 * Moving a planned recipe to another day with the date picker in its panel,
 * with a mouse and with a finger. The picker is HeroUI's DatePicker over React
 * Aria; nothing else in the suite opens its calendar, and their minors change
 * it without a type error.
 */
import type { Locator } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { seedRecipe } from "./cookbooks-support";
import { expect, test } from "./fixture";

/** The day of the month the recipe is planned on, as the calendar lists it. */
async function plannedDay(stack: AIE2EStack, recipeId: string): Promise<number | undefined> {
  const items = await queryTrpc<Array<{ date: string; recipeId: string | null }>>(
    stack.baseURL,
    stack.ownerCookies,
    "calendar.listItems",
    { startISO: "2000-01-01", endISO: "2999-12-31" }
  );
  const date = items.find((item) => item.recipeId === recipeId)?.date;

  return date ? Number(date.slice(8, 10)) : undefined;
}

/** Plans the recipe as the owner's dinner today, in the browser's own calendar. */
async function planForTonight(stack: AIE2EStack, recipeId: string): Promise<void> {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  await callTrpc(stack.baseURL, stack.ownerCookies, "calendar.createItem", {
    date: today,
    slot: "Dinner",
    itemType: "recipe",
    recipeId,
  });
}

for (const pointer of ["mouse", "touch"] as const) {
  test(`a planned recipe moves to another day through its date picker with a ${pointer}`, async ({
    browser,
    aiStack,
  }) => {
    const name = `Picker Stew ${pointer} ${Date.now()}`;

    const recipeId = await seedRecipe(name);

    await planForTonight(aiStack, recipeId);
    const context = await browser.newContext({
      baseURL: aiStack.baseURL,
      storageState: { cookies: aiStack.ownerCookies, origins: [] },
      viewport: pointer === "touch" ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      hasTouch: pointer === "touch",
    });
    const page = await context.newPage();
    const press = (target: Locator) => (pointer === "touch" ? target.tap() : target.click());

    try {
      await page.goto("/calendar");
      await press(page.getByText(name).first());
      const panel = page.getByRole("dialog");
      const day = panel.getByRole("spinbutton", { name: /day/i });

      await expect(day).toBeVisible();
      const target = Number(await day.getAttribute("aria-valuenow")) === 1 ? 2 : 1;

      await press(panel.getByRole("group").getByRole("button").first());
      const calendar = page.getByRole("grid");

      await expect(calendar).toBeVisible();
      await press(calendar.getByRole("button", { name: new RegExp(`\\b${target}\\b`) }).first());
      await expect(calendar).toBeHidden();
      await expect(day).toHaveAttribute("aria-valuenow", String(target));
      await press(panel.getByRole("button", { name: "Save" }));
      await expect(panel).toBeHidden();
      await expect.poll(() => plannedDay(aiStack, recipeId)).toBe(target);
    } finally {
      await context.close();
    }
  });
}
