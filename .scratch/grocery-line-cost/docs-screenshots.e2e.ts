/**
 * Capture the documentation screenshots for grocery prices against the same
 * harness-served shop the browser scenarios use, so the pictures in the docs
 * show the real app and no real supermarket is visited to make them.
 *
 * Not part of the gate. To re-capture: copy this file into
 * `apps/web/__tests__/e2e/ai/`, build (`rm -rf apps/web/.next && pnpm build:web
 * && pnpm build:server`), run `DOCS_SHOTS=1 pnpm exec playwright test --config
 * __tests__/e2e/playwright.config.ts --project=ai
 * __tests__/e2e/ai/docs-screenshots.e2e.ts` from `apps/web`, and delete the
 * copy again. Without DOCS_SHOTS the pictures land in SHOTS_DIR only, which is
 * how the panels and rows are eyeballed while working on them.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

import type { FakeShop } from "../harness/fake-shop";
import { createFakeShop } from "../harness/fake-shop";
import { expect, test } from "./fixture";
import { createShopStore } from "./grocery-prices-support";

test.describe.configure({ mode: "serial" });

const STORE_NAME = "Dirk";
const SHOTS = process.env.SHOTS_DIR ?? path.resolve(import.meta.dirname, "../.runtime/shots");
const TAG = process.env.SHOTS_TAG ?? "shot";
const DOCS = process.env.DOCS_SHOTS
  ? path.resolve(import.meta.dirname, "../../../../../apps/docs/static/img/screenshots")
  : null;

let shop: FakeShop;
let page: Page;

test.beforeAll(async ({ browser, aiStack }) => {
  mkdirSync(SHOTS, { recursive: true });
  shop = createFakeShop();
  await shop.start();
  await createShopStore(STORE_NAME, shop.url);

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
  await shop?.stop();
});

/** A working picture, and the documentation's copy of it where it has one. */
async function snap(name: string, docsName?: string, fullPage = false): Promise<void> {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `${TAG}-${name}.png`), fullPage });
  if (DOCS && docsName) await page.screenshot({ path: path.join(DOCS, docsName), fullPage });
}

async function desktop(): Promise<void> {
  await page.setViewportSize({ width: 1100, height: 820 });
}

async function mobile(): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
}

/** Escape out of whatever panels are open, nested ones first. */
async function closePanels(): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await page.getByRole("dialog").count()) === 0) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function addGrocery(name: string, shown: string = name): Promise<void> {
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill(name);
  await page.getByRole("button", { name: /Auto-detect from history/ }).click();
  await page.getByRole("option", { name: STORE_NAME }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(shown).first()).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("captures the store form with a derived Search Address", async () => {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).waitFor();
  await page.getByRole("button", { name: "View Mode" }).click();
  await page.getByRole("menuitem", { name: "Manage Stores" }).click();
  await page.getByRole("button", { name: "Edit" }).first().click();
  // The Store opens in a panel of its own over the list.
  await expect(page.getByRole("dialog", { name: "Edit Store" })).toBeVisible();
  await snap("store-editor");
  // A recognisable address rather than the harness's loopback port. The
  // derivation is pure, and this screenshot cancels rather than saving, so
  // nothing is ever fetched from it.
  await page.getByTestId("store-shop-link").fill("https://www.dirk.nl/zoeken/producten/kaas");
  await expect(page.getByTestId("search-address-preview")).toBeVisible();
  await snap("store-link", "groceries-store-link.png");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Edit Store" })).toBeHidden();
  await page.getByRole("button", { name: "Close panel" }).click();
});

test("captures a priced shopping list", async () => {
  await page.goto("/groceries");
  await addGrocery("kaas");
  await addGrocery("melk");
  // Two packs, a Sale, something sold by weight and a bare count, so the list
  // shows what a Line Cost looks like in each of its shapes.
  await addGrocery("700 g tarwebloem", "tarwebloem");
  await addGrocery("300 g geitenkaas plakken", "geitenkaas plakken");
  await addGrocery("700 g bananen los", "bananen los");
  await addGrocery("2 brood", "brood");

  await expect
    .poll(
      async () => {
        await page.reload();

        return page.getByTestId("grocery-price").count();
      },
      { timeout: 90_000 }
    )
    .toBeGreaterThanOrEqual(6);

  await snap("list-desktop", "groceries-prices.png");

  await mobile();
  await page.reload();
  await expect(page.getByTestId("grocery-price").first()).toBeVisible({ timeout: 30_000 });
  await snap("list-mobile", undefined, true);
  await desktop();
});

test("captures the grocery panel on a Sale, and the details behind it", async () => {
  for (const [size, tag] of [
    [desktop, "desktop"],
    [mobile, "mobile"],
  ] as const) {
    await size();
    await page.goto("/groceries");
    await page.getByText("geitenkaas plakken", { exact: true }).first().click();
    await expect(page.getByTestId("grocery-product-field")).toHaveValue("Geitenkaas plakken");
    await snap(`edit-${tag}`, tag === "desktop" ? "groceries-purchase-amount.png" : undefined);

    await page.getByTestId("product-details").click();
    await expect(page.getByTestId("product-by-hand-name")).toBeVisible();
    await snap(`edit-details-${tag}`);

    // A currency that is not one is said so, on the field and on the row.
    await page.getByTestId("product-by-hand-currency").fill("EU");
    await expect(page.getByTestId("product-currency-error")).toBeVisible();
    await snap(`edit-details-invalid-${tag}`);
    await page.getByTestId("product-by-hand-currency").fill("");
    await closePanels();
  }
  await desktop();
});

test("captures the product field, a picked product and what is refused", async () => {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill("beleg");
  await page.getByRole("button", { name: /Auto-detect from history/ }).click();
  await page.getByRole("option", { name: STORE_NAME }).click();
  await snap("add-desktop");
  // Two of the shop's products answer, one of them on Sale, and neither
  // carries both words: the shopper chooses, so the dropdown stays open.
  await page.getByTestId("grocery-product-field").fill("kaas plakken");
  await expect(page.getByRole("option")).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByTestId("product-searching")).toBeHidden({ timeout: 30_000 });
  await snap("add-picker-desktop", "groceries-picker.png");
  await page.getByRole("option", { name: /Oude kaas/ }).click();
  await expect(page.getByTestId("product-by-hand-price")).toHaveValue("4.99");
  await snap("add-picked-desktop");

  // A price that is not a price is said so, and Add waits for the fix.
  await page.getByTestId("product-by-hand-price").fill("4,9,9");
  await expect(page.getByTestId("product-price-error")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
  await snap("add-invalid-price-desktop");
  await page.getByTestId("product-by-hand-price").fill("4.99");
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeEnabled();

  await mobile();
  await snap("add-picked-mobile");
  await closePanels();

  // A grocery whose words carry a rhythm: the pill sits under the name.
  await page.goto("/groceries");
  await page
    .getByRole("button", { name: /Add item/i })
    .first()
    .click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill("melk every week");
  await page.getByRole("button", { name: /Auto-detect from history/ }).click();
  await page.getByRole("option", { name: STORE_NAME }).click();
  await snap("add-recurrence-mobile");
  await closePanels();
  await desktop();
});
