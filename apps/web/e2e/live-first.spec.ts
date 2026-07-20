import { randomUUID } from "node:crypto";
import { expect, test } from "@/e2e/fixtures";
import { PRIMARY_RECIPE_NAME } from "@/e2e/support/api";
import {
  readBrowserReadCache,
  waitForStableReadCache,
  warmPrimaryReadCache,
} from "@/e2e/support/cache";

test("@critical keeps a fresh load live-first and lets delayed live data win", async ({
  page,
  context,
  api,
}) => {
  await page.goto("/");
  await expect(page.getByText(PRIMARY_RECIPE_NAME, { exact: true }).first()).toBeVisible();
  await expect
    .poll(async () => (await readBrowserReadCache(page)).records.length)
    .toBeGreaterThan(0);
  await page.close();

  const liveOnlyName = `E2E live ${randomUUID().slice(0, 8)}`;

  await api.recipes.create.mutate({
    id: randomUUID(),
    name: liveOnlyName,
    systemUsed: "metric",
    recipeIngredients: [],
    steps: [],
    tags: [],
  });

  const freshPage = await context.newPage();

  await freshPage.route("**/api/trpc/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });
  const navigation = freshPage.goto("/", { waitUntil: "domcontentloaded" });

  await expect(freshPage.locator("[data-recipe-grid-skeleton]")).toBeVisible();
  await navigation;
  await expect(freshPage.getByText(liveOnlyName, { exact: true })).toBeVisible();
});

test("@critical restores every persisted offline view only after transport failure", async ({
  page,
  context,
}) => {
  await warmPrimaryReadCache(page);
  const before = await waitForStableReadCache(page);

  await page.close();
  const cachedPage = await context.newPage();

  await cachedPage.route("**/api/trpc/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.abort("failed");
  });

  let navigation = cachedPage.goto("/", { waitUntil: "domcontentloaded" });

  await navigation.catch(() => undefined);
  await expect(cachedPage.getByText(PRIMARY_RECIPE_NAME, { exact: true }).first()).toBeVisible();
  const cachedDashboardStatus = cachedPage.getByRole("status").filter({ hasText: "Saved data" });

  await expect(cachedDashboardStatus).toBeVisible();
  await expect(cachedDashboardStatus.locator("time")).toHaveAttribute(
    "datetime",
    /^\d{4}-\d{2}-\d{2}T/
  );

  await cachedPage.goto("/calendar", { waitUntil: "domcontentloaded" });
  await expect(cachedPage).toHaveURL("/calendar");
  await expect(cachedPage.getByText(PRIMARY_RECIPE_NAME, { exact: true }).first()).toBeVisible();

  await cachedPage.goto("/groceries", { waitUntil: "domcontentloaded" });
  await expect(cachedPage).toHaveURL("/groceries");
  await expect(cachedPage.getByText("E2E Tomatoes", { exact: true })).toBeVisible();
  await expect(cachedPage.getByText("E2E Market", { exact: true })).toBeVisible();
  await expect(cachedPage.getByText("Not available offline")).toHaveCount(0);

  const after = await readBrowserReadCache(cachedPage);
  const beforeRecords = before.records.map(({ id, dataUpdatedAt, persistedAt }) => ({
    id,
    dataUpdatedAt,
    persistedAt,
  }));
  const afterRecords = after.records.map(({ id, dataUpdatedAt, persistedAt }) => ({
    id,
    dataUpdatedAt,
    persistedAt,
  }));

  expect(afterRecords).toEqual(beforeRecords);
});
