/**
 * In-panel search pickers on a phone open their results above the input,
 * clear of the keyboard, and a result can be tapped: the parent picker and
 * the grocery store-product field.
 */
import type { Locator, Page } from "@playwright/test";

import type { FakeShop } from "../harness/fake-shop";
import { createFakeShop } from "../harness/fake-shop";
import { expect, test } from "./fixture";
import { createShopStore } from "./grocery-prices-support";
import { resetCatalogueScenario, seedCatalogue } from "./ingredient-catalogue-support";

test.describe.configure({ mode: "serial" });

const PHONE_VIEWPORT = { width: 390, height: 844 };
const STORE_NAME = "Phone Shop";

let shop: FakeShop;
let page: Page;

test.beforeAll(async ({ browser, aiStack }) => {
  await resetCatalogueScenario();
  await seedCatalogue([
    { name: "onion", aliases: [{ text: "onion", locale: "en" }] },
    { name: "red onion", aliases: [{ text: "red onion", locale: "en" }] },
  ]);
  shop = createFakeShop();
  await shop.start();
  await createShopStore(aiStack, STORE_NAME, shop.url);

  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
  });

  page = await context.newPage();
});

test.afterAll(async () => {
  await page?.context().close();
  await shop?.stop();
});

/** The open results sit above the input, no taller than a phone's cap of about five rows. */
async function expectResultsAbove(input: Locator): Promise<void> {
  const results = page.locator('[data-slot="combo-box-popover"]');

  await expect
    .poll(async () => {
      const [list, field] = await Promise.all([results.boundingBox(), input.boundingBox()]);

      return list && field ? list.y + list.height - field.y : null;
    })
    .toBeLessThanOrEqual(0);
  expect(
    await results.evaluate((element) => parseFloat(getComputedStyle(element).maxHeight))
  ).toBeLessThanOrEqual(240);
}

test("the parent picker opens its results above the input, and one can be tapped", async () => {
  await page.goto("/settings?tab=ingredients");
  await page.getByTestId("ingredients-search").fill("red onion");
  await page
    .locator('[data-testid="ingredient-row"][data-ingredient="red onion"]')
    .getByTestId("ingredient-toggle")
    .tap();
  const opened = page.getByRole("dialog", { name: "red onion", exact: true });

  await opened.getByTestId("ingredient-set-parent").tap();
  const asking = page.getByRole("dialog", { name: "Set parent…" });
  const input = asking.getByTestId("ingredient-picker");

  await input.fill("onion");
  const option = page.getByRole("option", { name: "onion", exact: true });

  await expect(option).toBeVisible();
  await expectResultsAbove(input);
  await option.tap();
  await expect(input).toHaveValue("onion");
  await asking.getByTestId("ingredient-relocation-confirm").tap();
  await expect(opened.getByTestId("ingredient-parent")).toContainText("onion");
});

test("the store-product field opens its results above the input, and one can be tapped", async () => {
  await page.goto("/groceries");
  await page.getByRole("button", { name: "Add items" }).tap();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill("melk");
  await page.getByRole("button", { name: /Auto-detect from history/ }).tap();
  await page.getByRole("option", { name: STORE_NAME }).tap();
  const input = page.getByTestId("grocery-product-field");

  // "melk" is a word two products share, so the shop's answer is offered rather than taken.
  await input.fill("melk");
  const option = page.getByRole("option", { name: /^Volle melk/ });

  await expect(option).toBeVisible({ timeout: 30_000 });
  await expectResultsAbove(input);
  await option.tap();
  await expect(input).toHaveValue("Volle melk");
});
