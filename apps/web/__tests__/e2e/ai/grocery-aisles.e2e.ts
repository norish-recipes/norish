/**
 * Grocery Aisles, in a browser, against a plain Store with no shop behind it.
 *
 * What a shopper actually does: gives a Store the aisles of the shop it stands
 * for and sees the list take that shape; files a row by dragging it into an
 * aisle, or from the grocery's own panel, and watches a same-named row follow,
 * because an Aisle Link is a fact about a name at a Store (ADR-0031); unfiles
 * by dragging back to the top; renames and removes an aisle and sees the rows
 * come back unfiled; ticks a row and watches it fold into the Store's done
 * row; drops a row on a Store that is nothing but a heading. The real Norish
 * server, database, Redis, tRPC and realtime are all in the path; nothing
 * outbound is, because a plain Store needs no shop.
 */
import type { Page } from "@playwright/test";

import { expect, test } from "./fixture";
import { createPlainStore, readAisleFiling, readStoreAisles } from "./grocery-aisles-support";
import { dragRowTo as dragRow } from "./grocery-dnd-support";

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

/** The aisle names of the Store's block, top to bottom; a filled heading also carries its count. */
async function aisleNamesOf(storeName: string = STORE): Promise<string[]> {
  return headingsOf(storeName).evaluateAll((headings) =>
    headings.map((heading) => heading.getAttribute("data-aisle-name") ?? "")
  );
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
  await dragRow(page, page.locator(`[data-grocery-name="${name}"]`).first(), target);
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
  // The editor that just closed lingers in the DOM for its closing animation,
  // with a Close button of its own; the manager's is the one to press.
  await page
    .getByRole("dialog", { name: "Manage Stores" })
    .getByRole("button", { name: "Close panel" })
    .click();
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
  await expect.poll(() => aisleNamesOf()).toEqual(["Groente", "Zuivel"]);
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
  // A filled aisle's heading says how many lines are under it; an empty one says nothing.
  await expect(aisleBlock("Zuivel").getByTestId("aisle-count")).toHaveText("2");
  await expect(aisleBlock("Groente").getByTestId("aisle-count")).toHaveCount(0);

  // Where a shopper actually arrives: a fresh list, filed by what the Store remembers.
  await page.reload();
  await expect.poll(() => aisleNamesOf()).toEqual(["Groente", "Zuivel"]);
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

  await expect.poll(() => aisleNamesOf()).toEqual(["Groente", "Zuivel en kaas"]);
  expect(await rowsIn("Zuivel en kaas")).toEqual(["halfvolle melk", "halfvolle melk"]);
  await expect.poll(() => readAisleFiling(STORE, "halfvolle melk")).toBe("Zuivel en kaas");

  // Removing the aisle needs no confirmation; what was under it is simply unfiled.
  await openStoreEditor();
  await page.getByTestId("remove-aisle").nth(1).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit Store" })).toBeHidden();
  await closeStoreManager();

  await expect.poll(() => aisleNamesOf()).toEqual(["Groente"]);
  await expect.poll(() => readAisleFiling(STORE, "halfvolle melk")).toBeNull();
  await page.reload();
  await expect.poll(() => aisleNamesOf()).toEqual(["Groente"]);
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
  // Two manual sources in one group: the breakdown line still names them.
  await expect(storeBlock().locator("[data-grocery-name='kip']")).toContainText("Manual Items");
  await setGrouped(false);

  // Filed apart — "kip" in Groente, "kip (diepvries)" in Zuivel — they are two
  // Aisle Links, and so two groups, though they fold to one grouping name.
  await openStoreEditor();
  await page.getByTestId("aisle-name").fill("Zuivel");
  await page.getByTestId("aisle-name").press("Enter");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit Store" })).toBeHidden();
  await closeStoreManager();
  await fileFromPanel("kip", "Groente");
  await fileFromPanel("kip (diepvries)", "Zuivel");
  await expect.poll(() => readAisleFiling(STORE, "kip")).toBe("Groente");
  await expect.poll(() => readAisleFiling(STORE, "kip diepvries")).toBe("Zuivel");

  await setGrouped(true);
  await expect(storeBlock().locator("[data-grocery-name='kip']")).toHaveCount(2);
  expect(await rowsIn("Groente")).toEqual(["kip"]);
  expect(await rowsIn("Zuivel")).toEqual(["kip"]);
  // Each is now a single manual row, with nothing more to say: no "Manual Items" line under it.
  await expect(storeBlock().locator("[data-grocery-name='kip']").first()).not.toContainText(
    "Manual Items"
  );
  await expect(storeBlock().locator("[data-grocery-name='kip']").last()).not.toContainText(
    "Manual Items"
  );
  await setGrouped(false);
});

test("dragging a row into an aisle files its name, and the same-named row follows", async () => {
  await page.goto("/groceries");
  // Two rows named "halfvolle melk" sit unfiled since their aisle was removed.
  await expect.poll(() => aisleNamesOf()).toEqual(["Groente", "Zuivel"]);

  await dragRowTo("halfvolle melk", aisleTarget("Zuivel"));

  await expect.poll(() => readAisleFiling(STORE, "halfvolle melk")).toBe("Zuivel");
  // Filing one filed both: an Aisle Link is a fact about the name (ADR-0031).
  expect((await rowsIn("Zuivel")).filter((name) => name === "halfvolle melk")).toHaveLength(2);
  expect(await unfiledRows()).not.toContain("halfvolle melk");
});

test("dragging a row back to the top of its Store unfiles the name, both rows with it", async () => {
  await dragRowTo("halfvolle melk", storeTarget());

  await expect.poll(() => readAisleFiling(STORE, "halfvolle melk")).toBeNull();
  expect(await rowsIn("Zuivel")).not.toContain("halfvolle melk");
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

test("a ticked grocery folds into the Store's done row; unticked from there, it returns to its aisle", async () => {
  await page.goto("/groceries");
  // "kip" is filed in Groente, and nothing in this Store is done yet.
  await expect.poll(() => rowsIn("Groente")).toContain("kip");
  const doneRow = () => storeBlock().getByTestId("done-heading");

  await expect(doneRow()).toBeHidden();

  // The visible checkbox, clicked the way a shopper clicks it; the input
  // behind it is hidden from the pointer.
  const kip = () => storeBlock().locator('[data-grocery-name="kip"]');

  await kip().locator('[data-slot="checkbox"]').click();

  // The row leaves its aisle for one closed row at the bottom of the card that counts it.
  await expect(doneRow()).toBeVisible();
  await expect(doneRow()).toHaveAttribute("data-state", "closed");
  await expect(doneRow()).toContainText("1 done");
  await expect(kip()).toHaveCount(0);
  expect(await rowsIn("Groente")).not.toContain("kip");

  // Opened, the done row shows it struck through, checkbox filled.
  await doneRow().getByRole("button").first().click();
  await expect(doneRow()).toHaveAttribute("data-state", "open");
  await expect(kip()).toBeVisible();
  await expect(kip().locator(".line-through")).toBeVisible();

  // Unticking it there returns it to Groente, and the done row goes with it.
  await kip().locator('[data-slot="checkbox"]').click();
  await expect(doneRow()).toBeHidden();
  await expect.poll(() => rowsIn("Groente")).toContain("kip");
});

test("an empty Store is its heading alone, takes a dropped row, and reads All done once that is ticked", async () => {
  const slager = "Slager";

  await createPlainStore(slager);
  await page.goto("/groceries");

  // A heading on the ground — the dot, the name, what is left — and no card under it.
  const heading = storeTarget(slager);

  await expect(heading).toBeVisible();
  await expect(heading.getByTestId("store-dot")).toBeVisible();
  // The dot holds no glyph, and the only drawing in the heading is its chevron.
  await expect(heading.getByTestId("store-dot").locator("svg")).toHaveCount(0);
  await expect(heading.locator("svg")).toHaveCount(1);
  await expect(heading.getByTestId("store-meta")).toHaveText("0 items");
  await expect(storeBlock(slager).getByTestId("store-card")).toHaveCount(0);

  // A bare heading is still somewhere to drop a row; the card grows under it.
  await dragRowTo("komkommer", heading);

  await expect(storeBlock(slager).getByTestId("store-card")).toBeVisible();
  await expect.poll(() => rowsOf(slager)).toEqual(["komkommer"]);
  await expect(heading.getByTestId("store-meta")).toHaveText("1 item");

  // Everything ticked: the dot becomes a check, the meta says so, the card is the done row alone.
  await storeBlock(slager)
    .locator('[data-grocery-name="komkommer"]')
    .locator('[data-slot="checkbox"]')
    .click();

  await expect(heading.getByTestId("store-meta")).toHaveText("All done");
  await expect(heading.getByTestId("store-dot")).toHaveAttribute("data-store-done", "true");
  await expect(storeBlock(slager).getByTestId("done-heading")).toContainText("1 done");
  await expect(storeBlock(slager).locator("[data-grocery-name]")).toHaveCount(0);
});
