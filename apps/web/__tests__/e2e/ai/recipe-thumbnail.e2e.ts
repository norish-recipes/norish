/**
 * Thumbnail choice through the recipe form: upload two synthetic images,
 * choose the second through the star action, save, reload, and read the
 * chosen image back from the detail page and the dashboard card.
 */
import path from "node:path";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixture";

test.describe.configure({ mode: "serial" });

const FIXTURES_DIR = path.join(import.meta.dirname, "fixtures");
const FIRST_IMAGE = path.join(FIXTURES_DIR, "supplied-photo.jpg");
const SECOND_IMAGE = path.join(FIXTURES_DIR, "generated-dish.jpg");
const RECIPE_NAME = "Thumbnail Choice Stew";

let page: Page;

test.beforeEach(({ page: testPage }) => {
  page = testPage;
});

test("choosing the second image as the thumbnail survives save and reload", async () => {
  await page.goto("/recipes/new");

  await page.getByPlaceholder("e.g., Chocolate Chip Cookies").fill(RECIPE_NAME);

  const fileInput = page.locator('input[type="file"]').first();

  await fileInput.setInputFiles(FIRST_IMAGE);
  await expect(page.getByAltText("Image 1")).toBeVisible();
  await fileInput.setInputFiles(SECOND_IMAGE);
  await expect(page.getByAltText("Image 2")).toBeVisible();

  const chosenSrc = await page.getByAltText("Image 2").getAttribute("src");

  if (!chosenSrc) throw new Error("The uploaded image has no source");

  await page.getByRole("button", { name: "Set as thumbnail" }).click();
  await expect(page.getByAltText("Image 1")).toHaveAttribute("src", chosenSrc);

  await page.getByRole("button", { name: "Create Recipe" }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}/, { timeout: 30_000 });

  const hero = page.locator('img[alt="Recipe image"], img[alt^="Recipe media"]').first();

  await expect(hero).toHaveAttribute("src", chosenSrc);

  await page.reload();

  await expect(
    page.locator('img[alt="Recipe image"], img[alt^="Recipe media"]').first()
  ).toHaveAttribute("src", chosenSrc);

  await page.goto("/");

  await expect(page.getByAltText(RECIPE_NAME).first()).toHaveAttribute("src", chosenSrc);
});
