/**
 * Sign-out while Offline (CONTEXT.md): a browser cannot end its session without the server,
 * so nothing is forgotten and the reader is told why.
 */
import { signIn } from "../harness/auth";
import { expect, test, USER_A } from "./fixture";

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

    await offline.transition("stopped");
    await page.getByRole("button", { name: "Open user menu" }).click();
    await page.getByRole("menuitem", { name: "Logout" }).click();

    await expect(page.getByText("You're offline. Sign out when you're back online.")).toBeVisible();
    await expect(page).toHaveURL(/\/groceries$/);
    await expect(page.getByRole("button", { name: "Open user menu" })).toBeVisible();
  } finally {
    await offline.transition("live");
    await context.close();
  }
});
