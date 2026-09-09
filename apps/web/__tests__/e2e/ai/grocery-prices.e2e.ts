/**
 * Grocery prices, in a browser, against a shop the harness serves itself.
 *
 * The two paths a shopper actually walks: a name the Store recognises without
 * being asked, which is priced on its own; and a name it does not, which
 * opens the picker and is chosen by hand. The real Norish server, database,
 * Redis, the always-on store lookup worker, the reader, tRPC and realtime are
 * all in the path — only the supermarket is ours, because visiting a real one
 * from a test suite would be flaky and rude in equal measure.
 */
import type { Page } from "@playwright/test";

import type { FakeShop } from "../harness/fake-shop";
import { createFakeShop } from "../harness/fake-shop";
import { expect, test } from "./fixture";
import { dragRowTo } from "./grocery-dnd-support";
import {
  createShopStore,
  readGroceryAmount,
  readGroceryStore,
  readStoredLink,
} from "./grocery-prices-support";

test.describe.configure({ mode: "serial" });

const STORE_NAME = "E2E Shop";

let shop: FakeShop;
let page: Page;

test.beforeAll(async ({ browser, aiStack }) => {
  shop = createFakeShop();
  await shop.start();
  await createShopStore(STORE_NAME, shop.url);

  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
  });

  page = await context.newPage();
});

test.afterAll(async () => {
  await page?.context().close();
  await shop?.stop();
});

/**
 * Add a grocery to the Store the harness serves, through the panel a user
 * uses. `shown` is the name the row will carry once "700 g tarwebloem" has
 * been parsed into an amount, a unit and a name.
 */
async function addGroceryToShop(name: string, shown: string = name): Promise<void> {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill(name);
  await page.getByRole("button", { name: /Auto-detect from history/ }).click();
  await page.getByRole("option", { name: STORE_NAME }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(shown).first()).toBeVisible();
  // The add panel stays open for batch adding; the list underneath is what
  // every assertion here is about.
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

/** One grocery's own row, whichever Store's section it is sitting in. */
function rowFor(name: string) {
  return page.locator(`[data-grocery-name="${name}"]`).first();
}

/** Move a grocery into another Store's section the way a shopper does. */
async function dragGroceryToStore(name: string, storeName: string): Promise<void> {
  const target = page.locator(`[data-store-drop-target]`).filter({ hasText: storeName }).first();

  await dragRowTo(page, rowFor(name), target);
}

test("a name the shop states unmistakably is priced without being asked", async () => {
  await addGroceryToShop("kaas");

  // The Store has been asked and has not answered: the row says so with a
  // loader — a Pending Link, written before the job — rather than a blank
  // that reads as failure.
  await expect(rowFor("kaas").getByTestId("grocery-price-pending")).toBeVisible({
    timeout: 15_000,
  });

  // The lookup is a queue job — the add returned long before the shop answered
  // — and the price it landed reaches this already-open page over the Store
  // subscription, with no reload anywhere in this assertion.
  const price = page.getByTestId("grocery-price").first();

  await expect(price).toContainText(/4[.,]99/, { timeout: 60_000 });
  await expect(rowFor("kaas").getByTestId("grocery-price-pending")).toBeHidden();
  await expect(price).toContainText("500 g");
  // The row says which of the shop's products that price is for.
  await expect(page.getByTestId("grocery-product").first()).toHaveText("Oude kaas 500 g");
  expect((await readStoredLink("kaas"))?.productName).toBe("Oude kaas 500 g");
});

test("the grocery's own panel says which product it is, and can be pointed at another", async () => {
  const visitsBefore = shop.visits.length;

  await page.getByText("kaas").first().click();

  // The field reads what is linked now rather than opening empty, and says
  // what it costs.
  await expect(page.getByTestId("grocery-product-field")).toHaveValue("Oude kaas 500 g");
  await expect(page.getByTestId("product-by-hand-price")).toHaveValue("4.99");

  // Opening a grocery whose product is known asks the shop nothing at all.
  expect(shop.visits.length).toBe(visitsBefore);

  // Typing is what asks the shop; the field alone shows only what the Store
  // already knows.
  await page.getByTestId("grocery-product-field").fill("Roomboter");
  await page.getByRole("option", { name: /Roomboter/ }).click({ timeout: 30_000 });

  // Still nothing written: the panel's own Save is what commits a choice.
  expect((await readStoredLink("kaas"))?.productName).toBe("Oude kaas 500 g");

  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect
    .poll(async () => (await readStoredLink("kaas"))?.productName, { timeout: 30_000 })
    .toBe("Roomboter 250 g");
  await expect(page.getByTestId("grocery-product").first()).toHaveText("Roomboter 250 g");
});

test("the shop was visited once for the search and once for the product's own page", () => {
  expect(shop.visits.some((path) => path.startsWith("/search"))).toBe(true);
  expect(shop.visits).toContain("/p/oude-kaas");
});

test("a name the Store already knows is priced with no outbound request at all", async () => {
  await addGroceryToShop("melk");

  const priced = page.getByTestId("grocery-price").filter({ hasText: /1[.,]29/ });

  await expect(priced).toBeVisible({ timeout: 60_000 });

  // The Product Link is keyed by name, so it outlives the list line that
  // prompted it: next week's "melk" is priced without asking the shop again.
  // Exactly "melk": the aisles scenarios share this database and carry a
  // "halfvolle melk" of their own, which sits earlier on the page.
  await page.getByText("melk", { exact: true }).first().click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(priced).toBeHidden();

  const visitsBefore = shop.visits.length;

  await addGroceryToShop("melk");

  await expect(priced).toBeVisible();
  expect(shop.visits.length).toBe(visitsBefore);
});

test("a name the shop does not state is left to the shopper, and priced on Save", async () => {
  await addGroceryToShop("beleg");

  // A Miss is written, so the name is not searched again every time the list
  // is opened, and the row simply carries no price rather than an error.
  await expect
    .poll(async () => (await readStoredLink("beleg"))?.productName ?? "miss", { timeout: 60_000 })
    .toBe("miss");

  await page.reload();
  await page.getByText("beleg").first().click();
  // The shop has nothing under "beleg", so the shopper searches it for
  // something it does have. One product answers "brood", and a row a shopper
  // would not hesitate over is taken by the field itself rather than offered
  // back to be tapped — the shopper typed the choice already.
  await page.getByTestId("grocery-product-field").fill("brood");
  await expect(page.getByTestId("grocery-product-field")).toHaveValue("Bruin brood", {
    timeout: 30_000,
  });

  // Nothing is written until the panel's own Save.
  expect((await readStoredLink("beleg"))?.productName ?? null).toBeNull();

  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect
    .poll(async () => (await readStoredLink("beleg"))?.productName, { timeout: 30_000 })
    .toBe("Bruin brood");

  await expect(
    page.getByTestId("grocery-product").filter({ hasText: "Bruin brood" })
  ).toBeVisible();
});

test("a shop that answers nothing takes a price by hand, with no button to press", async () => {
  await page.goto("/groceries");
  await addGroceryToShop("sterrenstof");
  await page.getByText("sterrenstof").first().click();
  await page.getByTestId("grocery-product-field").fill("sterrenstof");
  await expect(page.getByTestId("product-by-hand")).toBeVisible({ timeout: 30_000 });

  await page.getByTestId("product-by-hand-price").fill("3.50");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect
    .poll(async () => (await readStoredLink("sterrenstof"))?.price, { timeout: 30_000 })
    .toBe("3.50");
});

test("a product chosen while adding is not overruled by the lookup queued for it", async () => {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill("kaasplakken");
  await page.getByRole("button", { name: /Auto-detect from history/ }).click();
  await page.getByRole("option", { name: STORE_NAME }).click();

  // "kaasplakken" would find nothing and be written off as a Miss; the
  // shopper says otherwise, and a shopper's answer is the answer. The one
  // product answering "Roomboter" is taken by the field for the typed term.
  await page.getByTestId("grocery-product-field").fill("Roomboter");
  await expect(page.getByTestId("grocery-product-field")).toHaveValue("Roomboter 250 g", {
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Close panel" }).click();

  // Long enough for the always-on lookup queue to have had its say.
  await page.waitForTimeout(10_000);

  expect((await readStoredLink("kaasplakken"))?.productName).toBe("Roomboter 250 g");
});

test("a grocery dragged into another Store is priced there, on the list", async () => {
  const second = "Second Shop";

  await createShopStore(second, shop.url);
  // A name no other scenario on this list uses, so every locator below is
  // about one row and one grocery.
  await page.goto("/groceries");
  await addGroceryToShop("roomboter");

  await expect(rowFor("roomboter").getByTestId("grocery-product")).toHaveText("Roomboter 250 g", {
    timeout: 60_000,
  });

  // The same name means a different product at the other shop, chosen by hand
  // there, so the two Stores hold different answers for one grocery name.
  await page.getByText("roomboter", { exact: true }).first().click();
  // The Store select is the panel's first; the Pack Size unit select sits under the product.
  await page.locator("[data-slot='select-trigger']").first().click();
  await page.getByRole("option", { name: second }).click();
  await page.getByTestId("grocery-product-field").fill("brood");
  // The one product answering "brood" is taken by the field for the typed term.
  await expect(page.getByTestId("grocery-product-field")).toHaveValue("Bruin brood", {
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(rowFor("roomboter").getByTestId("grocery-product")).toHaveText("Bruin brood", {
    timeout: 30_000,
  });

  // A fresh list, which is how a shopper actually arrives at one: it carries
  // what the Stores its groceries sit under know, and nothing about the Store
  // this one is about to be dragged into.
  await page.reload();
  await expect(rowFor("roomboter").getByTestId("grocery-product")).toHaveText("Bruin brood", {
    timeout: 30_000,
  });

  // Dragged back, the list must say what the first Store knows — without the
  // shopper opening anything to make it look.
  await dragGroceryToStore("roomboter", STORE_NAME);

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect
    .poll(async () => readGroceryStore("roomboter"), { timeout: 30_000 })
    .toBe(STORE_NAME);
  await expect(rowFor("roomboter").getByTestId("grocery-product")).toHaveText("Roomboter 250 g", {
    timeout: 30_000,
  });
});

test("700 g of a 500 g pack is two packs, on the row and at the heading", async () => {
  await page.goto("/groceries");
  // A name no other scenario uses, whose shop answers with one product of a
  // known Pack Size: the queue links it on its own.
  await addGroceryToShop("700 g tarwebloem", "tarwebloem");

  const row = rowFor("tarwebloem");

  await expect(row.getByTestId("grocery-product")).toHaveText("Tarwebloem", { timeout: 60_000 });
  // The Line Cost first, the packs after: two 500 g packs at €1.15.
  await expect(row.getByTestId("grocery-line-cost")).toContainText(/2[.,]30/);
  await expect(row.getByTestId("grocery-line-cost")).toContainText("2 × €1.15");
  await expect(row.getByTestId("grocery-price")).toHaveAttribute("data-grocery-packs", "2");

  // The heading is the sum of the Line Costs under it, so two packs count
  // twice: every row's own Line Cost in this Store's section, read off the
  // screen, adds up to the number in its heading.
  const section = row.locator("xpath=ancestor::*[@data-store-id]").first();
  const money = (text: string | null) =>
    Number(text?.match(/\d+[.,]\d{2}/)?.[0].replace(",", ".") ?? 0);

  await expect(section.getByTestId("store-total")).toBeVisible();
  // The heading reads what is left and what it costs, in one line.
  await expect(section.getByTestId("store-meta")).toContainText(/\d+ items · /);
  const heading = money(await section.getByTestId("store-total").textContent());
  const costs = await section.getByTestId("grocery-line-cost").allTextContents();
  const sum = costs.map(money).reduce((total, cost) => Math.round((total + cost) * 100) / 100, 0);

  expect(sum).toBeGreaterThanOrEqual(2.3);
  expect(heading).toBe(sum);
});

test("a product on Sale shows the struck price and the new one in a chip beside it", async () => {
  await page.goto("/groceries");
  await addGroceryToShop("300 g geitenkaas plakken", "geitenkaas plakken");

  const row = rowFor("geitenkaas plakken");

  await expect(row.getByTestId("grocery-product")).toContainText("Geitenkaas plakken", {
    timeout: 60_000,
  });
  // Two 150 g packs: the regular Line Cost struck through right before the
  // Sale one, the way a shelf tag reads.
  const money = row.getByTestId("grocery-line-cost");

  await expect(money.getByTestId("grocery-regular-cost")).toContainText(/6[.,]58/);
  await expect(money.getByTestId("grocery-sale")).toContainText(/4[.,]38/);
  // The shop's own words for the deal ride on the chip.
  await expect(money.getByTestId("grocery-sale")).toHaveAttribute("title", "Weekend actie");
  // And the product's name alone on its line.
  await expect(row.getByTestId("grocery-product")).toHaveText("Geitenkaas plakken");
});

test("a product on Sale corrected by hand keeps its Sale", async () => {
  await page.goto("/groceries");
  await page.getByText("geitenkaas plakken", { exact: true }).first().click();
  await expect(page.getByTestId("grocery-product-field")).toHaveValue("Geitenkaas plakken");

  // The name is corrected behind the details row; nothing else is touched.
  await page.getByTestId("product-details").click();
  await page.getByTestId("product-by-hand-name").fill("Geitenkaas plakken, 150 g");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();

  // The row is the same Sale under a better name: two 150 g packs, the
  // regular Line Cost struck through, the shop's words still there.
  const row = rowFor("geitenkaas plakken");

  await expect(row.getByTestId("grocery-product")).toHaveText("Geitenkaas plakken, 150 g", {
    timeout: 30_000,
  });
  await expect(row.getByTestId("grocery-price")).toHaveAttribute("data-grocery-packs", "2");
  await expect(row.getByTestId("grocery-sale")).toContainText(/4[.,]38/);
  await expect(row.getByTestId("grocery-regular-cost")).toContainText(/6[.,]58/);
  await expect(row.getByTestId("grocery-sale")).toHaveAttribute("title", "Weekend actie");
});

test("the shop's own page for the product opens from the panel", async () => {
  await page.goto("/groceries");
  await page.getByText("tarwebloem", { exact: true }).first().click();
  await expect(page.getByTestId("grocery-product-field")).toHaveValue("Tarwebloem");

  // The link is the product page the Store read the price from, opened in a
  // new tab: the shop's site is the shop's, not Norish.
  const link = page.getByTestId("product-page-link");

  await expect(link).toHaveAttribute("href", /\/p\/tarwebloem$/);
  await expect(link).toHaveAttribute("target", "_blank");
  const [opened] = await Promise.all([page.context().waitForEvent("page"), link.click()]);

  await expect(opened).toHaveURL(/\/p\/tarwebloem$/);
  await opened.close();
  await page.getByRole("button", { name: "Close panel" }).click();
});

test("what is sold loose is priced by the weight the line states", async () => {
  await page.goto("/groceries");
  await addGroceryToShop("700 g bananen los", "bananen los");

  const row = rowFor("bananen los");

  await expect(row.getByTestId("grocery-product")).toHaveText("Bananen los", { timeout: 60_000 });
  // 700 g of something priced per kilo at €1.89 is €1.32, and the row says
  // what weight it priced rather than a number of packs.
  await expect(row.getByTestId("grocery-line-cost")).toContainText(/1[.,]32/);
  await expect(row.getByTestId("grocery-line-cost")).toContainText("0.7 × €1.89");
});

test("editing the purchase amount preserves the requirement and survives reload", async () => {
  await page.goto("/groceries");
  await page.getByText("tarwebloem", { exact: true }).first().click();
  await expect(page.getByTestId("grocery-purchase-amount")).toHaveValue("2");
  await expect(page.getByTestId("pack-size")).toHaveCount(0);

  await page.getByTestId("grocery-purchase-amount").fill("3");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(rowFor("tarwebloem").getByTestId("grocery-line-cost")).toContainText(
    "€3.45 (3 × €1.15)"
  );
  // Wait for the persisted server event before reload: the optimistic number alone is insufficient.
  await expect
    .poll(async () => {
      const grocery = await readGroceryAmount("tarwebloem");
      return grocery?.purchaseAmount;
    })
    .toBe(3);
  await page.reload();
  await expect(rowFor("tarwebloem")).toContainText("700");
  await expect(rowFor("tarwebloem").getByTestId("grocery-line-cost")).toContainText(
    "€3.45 (3 × €1.15)"
  );

  await page.getByText("tarwebloem", { exact: true }).first().click();
  await expect(page.getByTestId("grocery-purchase-amount")).toHaveValue("3");
  await page.getByRole("button", { name: "Use calculated amount", exact: true }).click();
  await expect(page.getByTestId("grocery-purchase-amount")).toHaveValue("2");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await readGroceryAmount("tarwebloem"))?.purchaseAmount).toBeNull();
  await page.reload();
  await expect(rowFor("tarwebloem").getByTestId("grocery-line-cost")).toContainText(
    "€2.30 (2 × €1.15)"
  );
});

test("a purchase amount chosen during creation is saved with the grocery", async () => {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill("200 g bakbloem");
  await page.getByRole("button", { name: /Auto-detect from history/ }).click();
  await page.getByRole("option", { name: STORE_NAME }).click();
  await page.getByTestId("grocery-product-field").fill("Tarwebloem");
  await expect(page.getByTestId("product-by-hand-price")).toHaveValue("1.15");
  await page.getByTestId("grocery-purchase-amount").fill("4");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect.poll(async () => (await readGroceryAmount("bakbloem"))?.purchaseAmount).toBe(4);
  await page.reload();
  await expect(rowFor("bakbloem")).toContainText("200");
  await expect(rowFor("bakbloem").getByTestId("grocery-line-cost")).toContainText(
    "€4.60 (4 × €1.15)"
  );
});
