/**
 * A link on the clipboard is offered for import, on the dashboard and on any
 * other page.
 *
 * Chromium hands the clipboard over without a gesture once the permission is
 * granted, which the browser context does here. The link is put on the
 * clipboard from inside the page, and the window's focus event is what makes
 * the dashboard look again, exactly as coming back from another tab does.
 */
import type { Page } from "@playwright/test";

import { submitMutation } from "../harness/trpc";
import { expect, test } from "./fixture";

test.describe.configure({ mode: "serial" });

const ASK = "Import a recipe from the link you copied?";
const COPIED_LINK = "https://norish-test.invalid/recipes/clipboard-soup";
const ANOTHER_LINK = "https://norish-test.invalid/recipes/clipboard-stew";
const GROCERIES_LINK = "https://norish-test.invalid/recipes/clipboard-pie";

async function openDashboard(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("add-library-button")).toBeVisible();
}

/** Copy a link elsewhere, then come back to the dashboard. */
async function copyAndComeBack(page: Page, link: string): Promise<void> {
  await page.evaluate(async (text) => {
    await navigator.clipboard.writeText(text);
    window.dispatchEvent(new Event("focus"));
  }, link);
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

test("a copied link is offered on the dashboard, and Import queues it", async ({ page }) => {
  await openDashboard(page);
  await copyAndComeBack(page, COPIED_LINK);

  const ask = page.getByText(ASK);

  await expect(ask).toBeVisible();
  await expect(page.getByText(COPIED_LINK)).toBeVisible();

  await submitMutation(page, "recipes.importFromUrl", () =>
    page.getByRole("button", { name: "Import", exact: true }).click()
  );
  await expect(ask).toBeHidden();

  // The link this tab has asked about is not asked about again, reload or not;
  // a different one is.
  await page.reload();
  await expect(page.getByTestId("add-library-button")).toBeVisible();
  await copyAndComeBack(page, COPIED_LINK);
  await page.waitForTimeout(1_000);
  await expect(ask).toBeHidden();

  await copyAndComeBack(page, ANOTHER_LINK);
  await expect(ask).toBeVisible();
  await expect(page.getByText(ANOTHER_LINK)).toBeVisible();
});

test("a link into Norish itself is not offered", async ({ page, aiStack }) => {
  await openDashboard(page);
  await copyAndComeBack(page, `${aiStack.baseURL}/recipes/some-recipe`);
  await page.waitForTimeout(1_000);

  await expect(page.getByText(ASK)).toBeHidden();
});

test("a link copied on another page is offered there, and Import lands on the dashboard", async ({
  page,
}) => {
  await page.goto("/groceries");
  await expect(page.getByRole("button", { name: "Add Item" })).toBeVisible();
  await copyAndComeBack(page, GROCERIES_LINK);

  const ask = page.getByText(ASK);

  await expect(ask).toBeVisible();
  await submitMutation(page, "recipes.importFromUrl", () =>
    page.getByRole("button", { name: "Import", exact: true }).click()
  );
  await expect(ask).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("add-library-button")).toBeVisible();
});
