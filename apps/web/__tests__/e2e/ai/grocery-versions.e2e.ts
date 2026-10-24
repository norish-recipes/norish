/**
 * A write on a grocery is guarded by the version the screen holds (ADR-0004),
 * so every screen must learn a row's new version whenever the server moves
 * it — including the siblings a create shifts down to make room at the top.
 * Before this was so, a grocery ticked after another had been added to its
 * Store was refused as stale and read as un-done again after the refetch.
 */
import type { Page } from "@playwright/test";

import { findNewestGroceryNamed } from "@norish/db/repositories/groceries";

import { expect, test } from "./fixture";
import { createPlainStore } from "./grocery-aisles-support";

const STORE = "Versies";

let page: Page;

test.beforeAll(async ({ browser, aiStack }) => {
  await createPlainStore(aiStack, STORE);
  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
  });

  page = await context.newPage();
});

test.afterAll(async () => {
  await page?.context().close();
});

async function addGrocery(name: string): Promise<void> {
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill(name);
  await page.getByRole("button", { name: /Auto-detect from history/ }).click();
  await page.getByRole("option", { name: STORE }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(`[data-grocery-name="${name}"]`).first()).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

function rowFor(name: string) {
  return page.locator(`[data-grocery-name="${name}"]`).first();
}

/** The visible checkbox of a row, clicked the way a shopper clicks it. */
function checkboxOf(name: string) {
  return rowFor(name).locator('[data-slot="checkbox"]').first();
}

/**
 * A ticked row folds into the Store's done row, closed until tapped; open it
 * so the row can be looked at. A row un-done by a stale refetch would be back
 * among the active rows instead, and the done row gone with it.
 */
async function openDoneRow(): Promise<void> {
  const doneRow = page
    .locator("[data-store-id]")
    .filter({ has: page.locator("[data-store-drop-target]").filter({ hasText: STORE }) })
    .last()
    .getByTestId("done-heading");

  await expect(doneRow).toBeVisible();
  if ((await doneRow.getAttribute("data-state")) !== "open") {
    await doneRow.getByRole("button").first().click();
  }
  await expect(doneRow).toHaveAttribute("data-state", "open");
}

test("a grocery ticked after another was added to its Store stays done", async () => {
  await page.goto("/groceries");
  await addGrocery("versie-appel");
  // A second line in the same Store, added without a reload in between: the
  // first was shifted down to make room, and its version moved with it.
  await addGrocery("versie-peer");
  await expect
    .poll(() => findNewestGroceryNamed("versie-appel").then((row) => row?.version))
    .toBe(2);

  await checkboxOf("versie-appel").click();

  await expect
    .poll(() => findNewestGroceryNamed("versie-appel").then((row) => row?.isDone), {
      timeout: 10_000,
    })
    .toBe(true);
  // Long enough for a stale-driven refetch, were there one, to have un-done it.
  await page.waitForTimeout(3000);
  await openDoneRow();
  await expect(rowFor("versie-appel").getByRole("checkbox")).toBeChecked();
  expect((await findNewestGroceryNamed("versie-appel"))?.isDone).toBe(true);
});

test("and so does the one added last, with nothing moved since", async () => {
  await checkboxOf("versie-peer").click();

  await expect
    .poll(() => findNewestGroceryNamed("versie-peer").then((row) => row?.isDone), {
      timeout: 10_000,
    })
    .toBe(true);
  await page.waitForTimeout(3000);
  await openDoneRow();
  await expect(rowFor("versie-peer").getByRole("checkbox")).toBeChecked();
});
