/**
 * Ingredient Icons in a browser.
 *
 * What a household sees: an icon uploaded in a food's panel shows beside the
 * food on a recipe and on the grocery list once it is saved, and not before;
 * a kind of the food with no icon of its own shows its parent's; Generate
 * draws one with the image provider into the draft; a reader who hid
 * Ingredient Icons sees none; and Fill gaps' Icons draws a food that had
 * none. The scenario seeds a small catalogue of its own (the harness fetches
 * no Open Food Facts seed), and the fake AI provider's image route stands in
 * for the image provider. The real server, database, Valkey, queue and
 * realtime are all in the path.
 */
import type { Locator, Page } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import { clearDevicePreferences, setDevicePreferences } from "../harness/device-preferences";
import { seedRecipe } from "./cookbooks-support";
import { expect, test } from "./fixture";
import { configureImageGeneration } from "./image-generation-support";
import {
  openCataloguePanel,
  resetCatalogueScenario,
  seedCatalogue,
  setParent,
} from "./ingredient-catalogue-support";
import { pictureFile, pictureOfFood, readOwnIcon, seedGrocery } from "./ingredient-icons-support";

test.describe.configure({ mode: "serial" });

const RECIPE = "Onion and kohlrabi slaw";

let stack: AIE2EStack;
let page: Page;
let recipeId: string;

test.beforeAll(async ({ browser, aiStack }) => {
  stack = aiStack;
  await resetCatalogueScenario();
  await configureImageGeneration(stack, null);

  const ids = await seedCatalogue([
    { name: "onion", aliases: [{ text: "onion", locale: "en" }] },
    { name: "red onion", aliases: [{ text: "red onion", locale: "en" }] },
    { name: "kohlrabi", aliases: [{ text: "kohlrabi", locale: "en" }] },
    { name: "parsnip", aliases: [{ text: "parsnip", locale: "en" }] },
  ]);

  await setParent(aiStack, ids["red onion"]!, ids.onion!);
  recipeId = await seedRecipe(RECIPE, ["onion", "red onion", "kohlrabi"]);
  await seedGrocery(aiStack, "onion");

  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
  });

  page = await context.newPage();
});

test.afterAll(async () => {
  await configureImageGeneration(stack, null);
  await page?.context().close();
});

/** The Ingredients page's panel for a food, opened from its row. */
async function openPanel(name: string): Promise<Locator> {
  await page.goto("/settings?tab=ingredients");
  await page.getByTestId("ingredients-search").fill(name);
  await page
    .locator(`[data-testid="ingredient-row"][data-ingredient="${name}"]`)
    .getByTestId("ingredient-toggle")
    .click();

  return page.getByRole("dialog", { name, exact: true });
}

/** A recipe line's icon, in the layout the window shows. */
function lineIcon(name: string): Locator {
  return page
    .locator("li:visible")
    .filter({ has: page.getByText(name, { exact: true }) })
    .getByTestId("ingredient-icon");
}

async function openRecipe(): Promise<void> {
  await page.goto(`/recipes/${recipeId}`);
  await expect(page.getByRole("heading", { name: RECIPE }).first()).toBeVisible();
}

test("an icon uploaded in the panel shows on the recipe and the grocery list once saved", async () => {
  const opened = await openPanel("onion");

  await opened.getByTestId("ingredient-icon-file").setInputFiles(await pictureFile("#b4587a"));
  // The cut-out icon waits in the draft: the panel shows it, the food has none yet.
  await expect(
    opened.getByTestId("ingredient-panel-icon").getByTestId("ingredient-icon")
  ).toHaveAttribute("src", /^\/ingredient-icons\/[a-f0-9]{32}\.webp$/);
  expect(await readOwnIcon(stack, "onion")).toBeNull();

  await opened.getByTestId("ingredient-save").click();
  await expect.poll(() => readOwnIcon(stack, "onion")).not.toBeNull();
  const icon = (await readOwnIcon(stack, "onion"))!;

  await openRecipe();
  await expect(lineIcon("onion")).toHaveAttribute("src", icon);

  await page.goto("/groceries");
  await expect(
    page
      .locator('[data-testid="grocery-row"][data-grocery-name="onion"]:visible')
      .getByTestId("ingredient-icon")
  ).toHaveAttribute("src", icon);

  // The icon is a file the server serves, to anyone: a shared recipe shows it signed out.
  const served = await page.request.get(icon);

  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/webp");
});

test("a kind of the food with no icon of its own shows its parent's", async () => {
  const icon = (await readOwnIcon(stack, "onion"))!;

  await openRecipe();
  await expect(lineIcon("red onion")).toHaveAttribute("src", icon);
  // A food with no icon anywhere shows none.
  const kohlrabi = page
    .locator("li:visible")
    .filter({ has: page.getByText("kohlrabi", { exact: true }) });

  await expect(kohlrabi).toBeVisible();
  await expect(kohlrabi.getByTestId("ingredient-icon")).toHaveCount(0);
});

test("Generate draws an icon into the draft, which shows on the recipe only after Save", async () => {
  await configureImageGeneration(stack, stack.ai.url);
  stack.ai.control.succeedImageWith((await pictureOfFood("#8fb04a")).toString("base64"));

  const opened = await openPanel("kohlrabi");

  await opened.getByTestId("ingredient-panel-icon").click();
  await page.getByRole("menuitem", { name: "Generate with AI" }).click();
  await expect(
    opened.getByTestId("ingredient-panel-icon").getByTestId("ingredient-icon")
  ).toBeVisible();
  expect(stack.ai.control.imageRequestCount).toBe(1);
  expect(await readOwnIcon(stack, "kohlrabi")).toBeNull();

  await openRecipe();
  await expect(lineIcon("kohlrabi")).toHaveCount(0);

  const reopened = await openPanel("kohlrabi");

  // A draft does not outlive its panel: drawn again, and this time saved.
  await reopened.getByTestId("ingredient-panel-icon").click();
  await page.getByRole("menuitem", { name: "Generate with AI" }).click();
  await expect(
    reopened.getByTestId("ingredient-panel-icon").getByTestId("ingredient-icon")
  ).toBeVisible();
  await reopened.getByTestId("ingredient-save").click();
  await expect.poll(() => readOwnIcon(stack, "kohlrabi")).not.toBeNull();

  await openRecipe();
  await expect(lineIcon("kohlrabi")).toHaveAttribute(
    "src",
    (await readOwnIcon(stack, "kohlrabi"))!
  );
});

test("hiding Ingredient icons takes them off the recipe page", async () => {
  // The suite's browser is a desktop.
  await setDevicePreferences(stack.baseURL, stack.ownerCookies, "desktop", {
    hiddenItems: ["ingredientIcons"],
  });
  try {
    await openRecipe();
    await expect(page.getByText("kohlrabi", { exact: true }).first()).toBeVisible();
    await expect(page.locator('[data-testid="ingredient-icon"]:visible')).toHaveCount(0);
  } finally {
    await clearDevicePreferences();
  }
});

test("Fill gaps' Icons draws only a food that shows no icon", async () => {
  await configureImageGeneration(stack, stack.ai.url);
  stack.ai.control.succeedImageWith((await pictureOfFood("#e8a33b")).toString("base64"));

  const panel = await openCataloguePanel(page);

  await panel.getByTestId("fill-gaps").click();
  const dialog = page.getByTestId("fill-gaps-dialog");

  // Only parsnip shows no icon: onion and kohlrabi have their own, red onion borrows.
  await expect(dialog.getByTestId("fill-gaps-icons")).toContainText("1 ingredient");
  await dialog.getByTestId("fill-gaps-icons").getByText("Icons", { exact: true }).click();
  await dialog.getByTestId("fill-gaps-start").click();
  await expect(dialog).toBeHidden();

  await expect.poll(() => readOwnIcon(stack, "parsnip"), { timeout: 60_000 }).not.toBeNull();
  // The run touched nothing that already showed an icon.
  expect(stack.ai.control.imageRequestCount).toBe(1);

  await page.goto("/settings?tab=ingredients");
  await page.getByTestId("ingredients-search").fill("parsnip");
  await expect(
    page
      .locator('[data-testid="ingredient-row"][data-ingredient="parsnip"]')
      .getByTestId("ingredient-icon")
  ).toHaveAttribute("src", (await readOwnIcon(stack, "parsnip"))!);
});
