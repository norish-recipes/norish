/**
 * Sign-out while Offline (CONTEXT.md): a browser cannot end its session without the server,
 * so nothing is forgotten and the reader is told why.
 */
import { signIn } from "../harness/auth";
import {
  expect,
  persistedReadsHold,
  readOutbox,
  SEEDED_GROCERY_NAME,
  test,
  USER_A,
} from "./fixture";

test("signing out while Offline keeps the reader signed in and says why", async ({
  browser,
  offlineHarness: offline,
}) => {
  const context = await browser.newContext({ baseURL: offline.baseURL, serviceWorkers: "allow" });

  try {
    await context.addCookies(await signIn(offline.baseURL, USER_A));
    const page = await context.newPage();

    await page.goto("/groceries");
    await expect(page.getByRole("button", { name: "Open user menu" })).toBeVisible();
    await expect.poll(() => persistedReadsHold(page, SEEDED_GROCERY_NAME)).toBe(true);

    await offline.transition("stopped");
    await page.getByRole("button", { name: "Add Item" }).click();
    await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill("E2E Kept Butter");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect.poll(async () => (await readOutbox(page)).length).toBe(1);
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("e.g., 2 lbs chicken breast")).toBeHidden();

    await page.getByRole("button", { name: "Open user menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    // The queued change asks first; agreeing still ends nothing without the server.
    await page.getByRole("button", { name: "Sign out", exact: true }).click();

    await expect(page.getByText("You're offline. Sign out when you're back online.")).toBeVisible();
    await expect(page).toHaveURL(/\/groceries$/);
    await expect(page.getByRole("button", { name: "Open user menu" })).toBeVisible();
    // Nothing was forgotten: the saved reads and the queued change are still here.
    expect(await persistedReadsHold(page, SEEDED_GROCERY_NAME)).toBe(true);
    expect(await readOutbox(page)).toHaveLength(1);
  } finally {
    await offline.transition("live");
    await context.close();
  }
});
