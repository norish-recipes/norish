/**
 * A write on a grocery is guarded by the version the screen holds (ADR-0004).
 * A create shifts its Store's open lines down without bumping their versions,
 * so a line ticked after another was added is not refused as stale and un-done.
 */
import type { Page } from "@playwright/test";

import { closePanel, rowFor } from "../harness/groceries";
import { expect, test } from "./fixture";
import { createPlainStore } from "./grocery-aisles-support";
import { readOwnerGrocery } from "./grocery-prices-support";

const STORE = "Versies";

let page: Page;

// The second test ticks the line the first one added, on the same page.
test.describe.configure({ mode: "serial" });

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
  await expect(rowFor(page, name)).toBeVisible();
  await closePanel(page);
}

/** The visible checkbox of a row, clicked the way a shopper clicks it. */
function checkboxOf(name: string) {
  return rowFor(page, name).locator('[data-slot="checkbox"]').first();
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
  // first is shifted down to make room, its version left where the screen holds it.
  await addGrocery("versie-peer");
  await expect
    .poll(() => readOwnerGrocery("versie-appel").then((row) => [row?.sortOrder, row?.version]))
    .toEqual([1, 1]);

  await checkboxOf("versie-appel").click();

  await expect
    .poll(() => readOwnerGrocery("versie-appel").then((row) => row?.isDone), {
      timeout: 10_000,
    })
    .toBe(true);
  // Long enough for a stale-driven refetch, were there one, to have un-done it.
  await page.waitForTimeout(3000);
  await openDoneRow();
  await expect(rowFor(page, "versie-appel").getByRole("checkbox")).toBeChecked();
  expect((await readOwnerGrocery("versie-appel"))?.isDone).toBe(true);
});

test("and so does the one added last, with nothing moved since", async () => {
  await checkboxOf("versie-peer").click();

  await expect
    .poll(() => readOwnerGrocery("versie-peer").then((row) => row?.isDone), {
      timeout: 10_000,
    })
    .toBe(true);
  await page.waitForTimeout(3000);
  await openDoneRow();
  await expect(rowFor(page, "versie-peer").getByRole("checkbox")).toBeChecked();
});
