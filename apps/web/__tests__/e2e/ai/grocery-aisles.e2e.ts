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
import { createPlainStore, readAisleFiling, readStoreAisles } from "./grocery-aisles-support";

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

/**
 * Add a grocery under the Store, through the panel a shopper uses. `shown` is
 * the name the row will carry once "1 l halfvolle melk" has been parsed into
 * an amount, a unit and a name.
 */
async function addGrocery(
  name: string,
  storeName: string = STORE,
  shown: string = name
): Promise<void> {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill(name);
  await page.getByRole("button", { name: /Auto-detect from history/ }).click();
  await page.getByRole("option", { name: storeName }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(shown).first()).toBeVisible();
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

/** The same rows regardless of order: new rows land at the top, and order is not what these are about. */
const sorted = (names: readonly string[]) => [...names].sort();

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

/** One aisle's block within the Store's: its heading and what is filed under it. */
function aisleBlock(aisleName: string, storeName: string = STORE) {
  return storeBlock(storeName)
    .locator("[data-aisle-id]")
    .filter({ has: page.getByTestId("aisle-heading").filter({ hasText: aisleName }) });
}

/** The rows filed under one aisle, top to bottom. */
async function rowsIn(aisleName: string, storeName: string = STORE): Promise<string[]> {
  return aisleBlock(aisleName, storeName)
    .locator("[data-grocery-name]")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-grocery-name") ?? ""));
}

/** The rows at the top of the Store's block, under no heading. */
async function unfiledRows(storeName: string = STORE): Promise<string[]> {
  return storeBlock(storeName)
    .locator("[data-grocery-name]")
    .evaluateAll((rows) =>
      rows
        .filter((row) => row.closest("[data-aisle-id]") === null)
        .map((row) => row.getAttribute("data-grocery-name") ?? "")
    );
}

/** Move a grocery's row onto a drop target the way a shopper does. */
async function dragRowTo(name: string, target: ReturnType<Page["locator"]>): Promise<void> {
  // dnd-kit marks its own activator, which sits inside the row in the grouped
  // list and just outside it in the plain one.
  const row = page.locator(`[data-grocery-name="${name}"]`).first();
  const inside = row.locator("button[aria-roledescription]");
  const handle =
    (await inside.count()) > 0
      ? inside.first()
      : row.locator("xpath=..").locator("button[aria-roledescription]").first();

  // Both ends of the drag have to be on screen at once for the pointer to
  // travel between them.
  await page.setViewportSize({ width: 1280, height: 1600 });
  await handle.scrollIntoViewIfNeeded();

  const from = await handle.boundingBox();
  const to = await target.boundingBox();

  if (!from || !to) throw new Error("The row or the drop target is not on screen");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // dnd-kit's pointer sensor waits for 8px before it calls this a drag.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 20, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 25 });
  await page.waitForTimeout(200);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 4, { steps: 5 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** An aisle's heading, the drop target for filing by drag. */
function aisleTarget(aisleName: string, storeName: string = STORE) {
  return storeBlock(storeName).locator("[data-aisle-drop-target]").filter({ hasText: aisleName });
}

/** A Store's own heading, the drop target for its unfiled area. */
function storeTarget(storeName: string = STORE) {
  return page.locator("[data-store-drop-target]").filter({ hasText: storeName }).first();
}

/** Open a grocery's panel and choose an aisle in its Aisle field, then Save. */
async function fileFromPanel(name: string, aisleName: string): Promise<void> {
  await page.getByText(name, { exact: true }).first().click();
  const field = page.getByTestId("aisle-selector");

  await expect(field).toBeVisible();
  await field.getByRole("button").click();
  await page.getByRole("option", { name: aisleName, exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

/** Switch the grouped list on or off from the view menu; the page says which it shows. */
async function setGrouped(on: boolean): Promise<void> {
  const shown = page.locator("[data-grocery-grouping]").first();
  const current = await shown.getAttribute("data-grocery-grouping");

  if ((current === "grouped") === on) return;
  await page.getByRole("button", { name: "View Mode" }).click();
  await page.getByRole("menuitem", { name: /Group ingredients/ }).click();
  await expect(shown).toHaveAttribute("data-grocery-grouping", on ? "grouped" : "flat");
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
  // The plain list, one row per line; the grouped list has its own scenario.
  await setGrouped(false);

  const before = await rowsOf();

  expect(sorted(before)).toEqual(["halfvolle melk", "komkommer", "kwark"]);

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

test("filing a name from the panel moves the row and its same-named sibling, here and after a reload", async () => {
  // Two lines, one name — a second line in another unit, which the list does
  // not merge into the first: an Aisle Link is a fact about the name, so
  // filing one files both (ADR-0031).
  await addGrocery("1 l halfvolle melk", STORE, "halfvolle melk");
  await expect(storeBlock().locator('[data-grocery-name="halfvolle melk"]')).toHaveCount(2);
  expect(sorted(await unfiledRows())).toEqual([
    "halfvolle melk",
    "halfvolle melk",
    "komkommer",
    "kwark",
  ]);

  await fileFromPanel("halfvolle melk", "Zuivel");

  await expect.poll(() => readAisleFiling(STORE, "halfvolle melk")).toBe("Zuivel");
  expect(await rowsIn("Zuivel")).toEqual(["halfvolle melk", "halfvolle melk"]);
  expect(sorted(await unfiledRows())).toEqual(["komkommer", "kwark"]);
  await expect(aisleBlock("Zuivel").getByTestId("aisle-heading")).toHaveAttribute(
    "data-aisle-empty",
    "false"
  );

  // Where a shopper actually arrives: a fresh list, filed by what the Store remembers.
  await page.reload();
  await expect(headingsOf()).toHaveText(["Groente", "Zuivel"]);
  expect(await rowsIn("Zuivel")).toEqual(["halfvolle melk", "halfvolle melk"]);
  expect(sorted(await unfiledRows())).toEqual(["komkommer", "kwark"]);

  // The panel reads what the Store remembers, and "No aisle" forgets it.
  await page.getByText("komkommer", { exact: true }).first().click();
  await expect(page.getByTestId("aisle-selector").getByRole("button")).toContainText("No aisle");
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await fileFromPanel("kwark", "Zuivel");
  await expect.poll(() => readAisleFiling(STORE, "kwark")).toBe("Zuivel");
  expect(sorted(await rowsIn("Zuivel"))).toEqual(["halfvolle melk", "halfvolle melk", "kwark"]);

  await fileFromPanel("kwark", "No aisle");
  await expect.poll(() => readAisleFiling(STORE, "kwark")).toBeNull();
  expect(sorted(await unfiledRows())).toEqual(["komkommer", "kwark"]);
});

test("renaming an aisle keeps what is filed under it; removing it returns the rows to the top", async () => {
  await openStoreEditor();
  await page.getByTestId("aisle-row-name").nth(1).fill("Zuivel en kaas");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit Store" })).toBeHidden();
  await closeStoreManager();

  await expect(headingsOf()).toHaveText(["Groente", "Zuivel en kaas"]);
  expect(await rowsIn("Zuivel en kaas")).toEqual(["halfvolle melk", "halfvolle melk"]);
  await expect.poll(() => readAisleFiling(STORE, "halfvolle melk")).toBe("Zuivel en kaas");

  // Removing the aisle needs no confirmation; what was under it is simply unfiled.
  await openStoreEditor();
  await page.getByTestId("remove-aisle").nth(1).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit Store" })).toBeHidden();
  await closeStoreManager();

  await expect(headingsOf()).toHaveText(["Groente"]);
  await expect.poll(() => readAisleFiling(STORE, "halfvolle melk")).toBeNull();
  await page.reload();
  await expect(headingsOf()).toHaveText(["Groente"]);
  await expect(storeBlock().locator("[data-grocery-name]")).toHaveCount(4);
  expect(sorted(await unfiledRows())).toEqual([
    "halfvolle melk",
    "halfvolle melk",
    "komkommer",
    "kwark",
  ]);
});

test("in the grouped list, kip and kip (diepvries) are two groups once filed apart", async () => {
  await addGrocery("kip");
  await addGrocery("kip (diepvries)");

  await setGrouped(true);
  // One grouping name, so one group, while neither is filed.
  await expect(storeBlock().locator("[data-grocery-name='kip']")).toHaveCount(1);
  await setGrouped(false);

  // Filed apart — "kip" in Groente, "kip (diepvries)" left at the top — they
  // are two Aisle Links, and so two groups.
  await fileFromPanel("kip", "Groente");
  await expect.poll(() => readAisleFiling(STORE, "kip")).toBe("Groente");
  expect(await readAisleFiling(STORE, "kip diepvries")).toBeNull();

  await setGrouped(true);
  await expect(storeBlock().locator("[data-grocery-name='kip']")).toHaveCount(2);
  expect(await rowsIn("Groente")).toEqual(["kip"]);
  expect(await unfiledRows()).toContain("kip");
  await setGrouped(false);
});

test("dragging a row into an aisle files its name, and the same-named row follows", async () => {
  await page.goto("/groceries");
  // Two rows named "halfvolle melk" sit unfiled since the aisle was removed.
  await expect(headingsOf()).toHaveText(["Groente"]);

  await openStoreEditor();
  await page.getByTestId("aisle-name").fill("Zuivel");
  await page.getByTestId("aisle-name").press("Enter");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit Store" })).toBeHidden();
  await closeStoreManager();
  await expect(headingsOf()).toHaveText(["Groente", "Zuivel"]);

  await dragRowTo("halfvolle melk", aisleTarget("Zuivel"));

  await expect.poll(() => readAisleFiling(STORE, "halfvolle melk")).toBe("Zuivel");
  // Filing one filed both: an Aisle Link is a fact about the name (ADR-0031).
  expect(await rowsIn("Zuivel")).toEqual(["halfvolle melk", "halfvolle melk"]);
  expect(await unfiledRows()).not.toContain("halfvolle melk");
});

test("dragging a row back to the top of its Store unfiles the name, both rows with it", async () => {
  await dragRowTo("halfvolle melk", storeTarget());

  await expect.poll(() => readAisleFiling(STORE, "halfvolle melk")).toBeNull();
  expect(await rowsIn("Zuivel")).toEqual([]);
  expect((await unfiledRows()).filter((name) => name === "halfvolle melk")).toHaveLength(2);
});

test("dragging a row into another Store's aisle moves it there and files it there", async () => {
  const bakker = "Bakker";

  await createPlainStore(bakker);
  await page.goto("/groceries");
  await openStoreEditor(bakker);
  await page.getByTestId("aisle-name").fill("Brood");
  await page.getByTestId("aisle-name").press("Enter");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit Store" })).toBeHidden();
  await closeStoreManager();

  await dragRowTo("kwark", aisleTarget("Brood", bakker));

  // Assigned to the Bakker, then filed there — and Markt's memory of the name
  // is not carried along, nor touched.
  await expect.poll(() => readAisleFiling(bakker, "kwark")).toBe("Brood");
  expect(await rowsIn("Brood", bakker)).toEqual(["kwark"]);
  expect(await rowsOf(STORE)).not.toContain("kwark");
  expect(await readAisleFiling(STORE, "kwark")).toBeNull();
});
