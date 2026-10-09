/**
 * Planning from the dashboard reaches the calendar page's own cached range
 * (issue #583).
 *
 * The calendar page's range is fetched when the page is visited and stays in
 * the cache — and in the persisted Offline Cache — while the user is on the
 * dashboard. A recipe planned there used to reach only the ranges with a
 * mounted subscription: the calendar page's range learned of it from nothing
 * but its next successful refetch, so a refetch that failed, or a range served
 * without one, showed a plan that was not there. The create's own result now
 * places the item in every cached range, so the calendar shows it even when
 * its refetch cannot be answered.
 */
import type { Page } from "@playwright/test";

import { seedRecipe } from "./cookbooks-support";
import { expect, test } from "./fixture";

test.describe.configure({ mode: "serial" });

const NAME = `Planned Stew ${Date.now()}`;

/** Whether the persisted query cache in IndexedDB holds `text` yet. */
function persistedCacheHolds(page: Page, text: string): Promise<boolean> {
  return page.evaluate(
    (wanted) =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open("norish-offline");

        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const database = open.result;

          if (!database.objectStoreNames.contains("keyval")) {
            database.close();
            resolve(false);

            return;
          }

          const all = database.transaction("keyval").objectStore("keyval").getAll();

          all.onsuccess = () => {
            database.close();
            resolve(JSON.stringify(all.result).includes(wanted));
          };
          all.onerror = () => {
            database.close();
            resolve(false);
          };
        };
      }),
    text
  );
}

async function visitCalendar(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Calendar" }).click();
  await page.waitForURL(/\/calendar/);
}

test("a recipe planned on the dashboard shows on the calendar page from the cache alone", async ({
  browser,
  aiStack,
}) => {
  // The service worker is bypassed on purpose: a page it controls fetches
  // through it, out of reach of the route below that has to fail the refetch.
  // The cache under test is the persisted query cache, which needs no worker.
  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: aiStack.ownerCookies, origins: [] },
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  await seedRecipe(NAME);

  await page.goto("/");
  await expect(page.locator("[data-recipe-card]").filter({ hasText: NAME })).toBeVisible();

  // The calendar page's range enters the cache on a first visit.
  await visitCalendar(page);
  await expect(
    page.getByRole("heading", { name: /calendar/i }).or(page.locator("main"))
  ).toBeVisible();
  await expect(page.getByText(NAME)).toHaveCount(0);

  // Back on the dashboard, today's dinner is planned through the Today section.
  await page.getByRole("link", { name: "Home" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.getByRole("button", { name: "Add Recipe Dinner" }).click();

  const dialog = page.getByRole("dialog");

  await expect(dialog).toBeVisible();
  await dialog.getByRole("button").filter({ hasText: NAME }).first().click();

  // Planning opens Add to Groceries for the recipe: After planning a recipe's
  // default. Closing it leaves the plan in place.
  const groceries = page.getByRole("dialog", { name: "Add to Groceries" });

  await expect(groceries).toBeVisible();
  await groceries.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(NAME).first()).toBeVisible();

  // From here on the calendar range cannot be refetched: what the page shows
  // is what the cache holds.
  let refetches = 0;

  await page.route(
    (url) => url.pathname.includes("/api/trpc/") && url.pathname.includes("calendar.listItems"),
    (route) => {
      refetches += 1;
      void route.abort("failed");
    }
  );

  await visitCalendar(page);
  await expect(page.getByText(NAME).first()).toBeVisible();
  expect(refetches).toBeGreaterThan(0);

  // A reload restores the persisted cache: the plan is still there. The copy
  // in IndexedDB is written after the cache changes, and by this point in the
  // project it is large, so the reload waits until it holds the plan.
  await expect.poll(() => persistedCacheHolds(page, NAME)).toBe(true);
  await page.reload();
  await expect(page.getByText(NAME).first()).toBeVisible();

  await context.close();
});
