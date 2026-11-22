import { expect, SEEDED_COOKBOOK_ID, SEEDED_RECIPE_ID, SEEDED_RECIPE_NAME, test } from "./fixture";

test("opens a recipe and keeps its cookbook destination without URL.parse", async ({
  offlineHarness,
}) => {
  const { page } = offlineHarness;

  await page.addInitScript(() => {
    Object.defineProperty(URL, "parse", { value: undefined, configurable: true });
  });

  const cookbookPath = `/cookbooks/${SEEDED_COOKBOOK_ID}`;
  await page.goto(`/recipes/${SEEDED_RECIPE_ID}?from=${encodeURIComponent(cookbookPath)}`);
  await expect(page.getByText(SEEDED_RECIPE_NAME).filter({ visible: true }).first()).toBeVisible();
  await expect(
    page.locator(`a[href="${cookbookPath}"]`).filter({ visible: true }).first()
  ).toBeVisible();
});
