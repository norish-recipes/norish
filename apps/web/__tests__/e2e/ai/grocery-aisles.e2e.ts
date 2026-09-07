/**
 * Grocery Aisles, in a browser, against a plain Store with no shop behind it.
 *
 * What a shopper actually does: gives a Store the aisles of the shop it stands
 * for and sees the list take that shape; files a row by dragging it into an
 * aisle, or from the grocery's own panel, and watches a same-named row follow,
 * because an Aisle Link is a fact about a name at a Store (ADR-0031); unfiles
 * by dragging back to the top; renames and removes an aisle and sees the rows
 * come back unfiled. The real Norish server, database, Redis, tRPC and
 * realtime are all in the path; nothing outbound is, because a plain Store
 * needs no shop.
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixture";
import { createPlainStore, readStoreAisles } from "./grocery-aisles-support";

test.describe.configure({ mode: "serial" });

const STORE = "Markt";

let page: Page;

test.beforeAll(async ({ browser, aiStack }) => {
  await createPlainStore(STORE);

  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
  });

  page = await context.newPage();
});

test.afterAll(async () => {
  await page?.context().close();
});

/** Add a grocery under the Store, through the panel a shopper uses. */
async function addGrocery(name: string, storeName: string = STORE): Promise<void> {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill(name);
  await page.getByRole("button", { name: /Auto-detect from history/ }).click();
  await page.getByRole("option", { name: storeName }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(name).first()).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

/** The Store's block on the list, whichever view is showing. */
function storeBlock(storeName: string = STORE) {
  return page
    .locator("[data-store-id]")
    .filter({ has: page.locator("[data-store-drop-target]").filter({ hasText: storeName }) })
    .last();
}

/** Every grocery row of the Store's block, top to bottom. */
async function rowsOf(storeName: string = STORE): Promise<string[]> {
  return storeBlock(storeName)
    .locator("[data-grocery-name]")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-grocery-name") ?? ""));
}

/** The aisle headings of the Store's block, top to bottom. */
function headingsOf(storeName: string = STORE) {
  return storeBlock(storeName).getByTestId("aisle-heading");
}

/** Open the Store in the store editor. */
async function openStoreEditor(storeName: string = STORE): Promise<void> {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).waitFor();
  await page.getByRole("button", { name: "View Mode" }).click();
  await page.getByRole("menuitem", { name: "Manage Stores" }).click();
  // The manager lists the household's Stores; the priced scenarios' shops
  // share this database, so the Edit button is the one on this Store's row.
  await page
    .getByRole("dialog", { name: "Manage Stores" })
    .getByRole("listitem")
    .filter({ hasText: storeName })
    .getByRole("button", { name: "Edit" })
    .click();
  await expect(page.getByRole("dialog", { name: "Edit Store" })).toBeVisible();
}

async function closeStoreManager(): Promise<void> {
  await page.getByRole("button", { name: "Close panel" }).last().click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("a Store given two aisles shows both headings, with the list unchanged above them", async () => {
  // Names no other scenario on this shared database uses, so every locator
  // below is about one row and one grocery.
  await addGrocery("halfvolle melk");
  await addGrocery("komkommer");
  await addGrocery("kwark");

  const before = await rowsOf();

  expect(before).toEqual(["halfvolle melk", "komkommer", "kwark"]);

  await openStoreEditor();
  await page.getByTestId("aisle-name").fill("Groente");
  await page.getByTestId("aisle-name").press("Enter");
  await page.getByTestId("aisle-name").fill("Zuivel");
  await page.getByTestId("add-aisle").click();
  // The same name again, in another case, is refused where it is typed.
  await page.getByTestId("aisle-name").fill("zuivel");
  await expect(page.getByTestId("aisle-duplicate")).toBeVisible();
  await expect(page.getByTestId("add-aisle")).toBeDisabled();
  await page.getByTestId("aisle-name").fill("");

  // Nothing is written until the editor's own Save.
  expect(await readStoreAisles(STORE)).toEqual([]);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit Store" })).toBeHidden();
  await closeStoreManager();

  await expect.poll(() => readStoreAisles(STORE)).toEqual(["Groente", "Zuivel"]);
  // Every aisle is a heading, in the Store's order, empty ones quieter; and
  // nothing has been filed, so every row still sits at the top, as it was.
  await expect(headingsOf()).toHaveText(["Groente", "Zuivel"]);
  await expect(headingsOf().first()).toHaveAttribute("data-aisle-empty", "true");
  expect(await rowsOf()).toEqual(before);

  const firstHeading = headingsOf().first();
  const lastRow = storeBlock().locator("[data-grocery-name]").last();

  expect(
    await lastRow.evaluate(
      (row, heading) =>
        Boolean(row.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING),
      await firstHeading.elementHandle()
    )
  ).toBe(true);
});
