import type { Page } from "@playwright/test";

import { updateRecipeCategories } from "@norish/db/repositories/recipes";

import { userIdOf } from "../harness/accounts";
import { signIn } from "../harness/auth";
import { recipeIdsNamed, seedRecipe } from "../harness/recipes";
import { expect, test, USER_A } from "./fixture";

/** The Outbox's entries in the page's IndexedDB. */
function readOutbox(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Array<{ path: string; status: string }>>((resolve) => {
        const open = indexedDB.open("norish-offline");

        open.onsuccess = () => {
          const db = open.result;

          if (!db.objectStoreNames.contains("outbox")) {
            db.close();
            resolve([]);

            return;
          }
          const request = db.transaction("outbox", "readonly").objectStore("outbox").getAll();

          request.onsuccess = () => {
            db.close();
            resolve(request.result as Array<{ path: string; status: string }>);
          };
          request.onerror = () => {
            db.close();
            resolve([]);
          };
        };
        open.onerror = () => resolve([]);
      })
  );
}

test("a bulk delete made offline keeps the recipe edited meanwhile, and says so", async ({
  offlineHarness,
}) => {
  const { page } = offlineHarness;
  const names = ["Offline Bulk Bagel", "Offline Bulk Brioche", "Offline Bulk Bun"];
  const card = (name: string) => page.locator("[data-recipe-card]").filter({ hasText: name });
  const toggle = (name: string) =>
    page
      .getByTestId("recipe-select-toggle")
      .filter({ has: page.getByRole("checkbox", { name, exact: true }) });

  await offlineHarness.transition("live");
  const userId = await userIdOf(USER_A);
  const ids: string[] = [];

  for (const name of names) ids.push(await seedRecipe(userId, name));
  await offlineHarness.context.clearCookies();
  await offlineHarness.context.addCookies(await signIn(offlineHarness.baseURL, USER_A));
  await page.setViewportSize({ width: 1280, height: 1600 });
  await page.goto("/");
  for (const name of names) await expect(card(name)).toBeVisible();

  await offlineHarness.transition("stopped");
  await card(names[0]!).click({ modifiers: ["Shift"] });
  await toggle(names[1]!).click();
  await toggle(names[2]!).click();
  await page
    .getByRole("toolbar", { name: "Selected recipes" })
    .getByRole("button", { name: "Delete" })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

  // One gesture, one Outbox entry.
  await expect.poll(() => readOutbox(page)).toHaveLength(1);
  expect((await readOutbox(page))[0]).toMatchObject({ path: "recipes.delete", status: "pending" });
  for (const name of names) await expect(card(name)).toBeHidden();

  // Meanwhile someone else changes the last one.
  await updateRecipeCategories(ids[2]!, ["Dinner"]);

  await offlineHarness.transition("live");
  await expect.poll(() => readOutbox(page), { timeout: 30_000 }).toHaveLength(0);
  // The socket comes back on its own backoff and resumes from its cursor.
  await expect(page.getByText("1 recipe was changed by someone else and kept.")).toBeVisible({
    timeout: 30_000,
  });
  await expect(card(names[2]!)).toBeVisible();
  expect(await recipeIdsNamed(names[0]!)).toEqual([]);
  expect(await recipeIdsNamed(names[1]!)).toEqual([]);
  expect(await recipeIdsNamed(names[2]!)).toEqual([ids[2]]);
});
