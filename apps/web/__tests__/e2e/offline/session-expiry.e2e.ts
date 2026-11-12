/**
 * Session Expiry (CONTEXT.md): the server ends a session the reader did not end. The device
 * forgets the Offline Cache, keeps the Outbox, and replays it once the same reader signs in.
 */
import { request } from "@playwright/test";

import type { SessionCookies } from "./fixture";
import { signIn } from "../harness/auth";
import { expect, SEEDED_RECIPE_IMAGE, test, USER_A } from "./fixture";

/** Ends the session these cookies carry on the server; the browser keeps its cookie. */
async function endSessionOnServer(baseURL: string, cookies: SessionCookies): Promise<void> {
  const api = await request.newContext({
    extraHTTPHeaders: { origin: new URL(baseURL).origin },
    storageState: { cookies, origins: [] },
  });

  try {
    const response = await api.post(`${baseURL}/api/auth/sign-out`, { data: {} });

    if (!response.ok()) throw new Error(`sign-out failed: ${response.status()}`);
  } finally {
    await api.dispose();
  }
}

test("an expired session clears the Offline Cache and keeps the queued change for its reader", async ({
  browser,
  offlineHarness: offline,
}) => {
  const cookies = await signIn(offline.baseURL, USER_A);
  const context = await browser.newContext({ baseURL: offline.baseURL, serviceWorkers: "allow" });

  try {
    await context.addCookies(cookies);
    const page = await context.newPage();
    const outboxSize = () =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const open = indexedDB.open("norish-offline");

            open.onsuccess = () => {
              const db = open.result;

              if (!db.objectStoreNames.contains("outbox")) {
                db.close();
                resolve(0);

                return;
              }
              const count = db.transaction("outbox", "readonly").objectStore("outbox").count();

              count.onsuccess = () => {
                db.close();
                resolve(count.result);
              };
            };
          })
      );
    const imagesKept = () => page.evaluate(() => caches.has("norish-images"));

    await page.goto("/groceries");
    // The Cache Warmer has run once A's recipe image is in the image cache.
    await expect
      .poll(
        () =>
          page.evaluate(
            async (url) => (await (await caches.open("norish-images")).match(url)) !== undefined,
            SEEDED_RECIPE_IMAGE
          ),
        { timeout: 60_000 }
      )
      .toBe(true);

    await offline.transition("stopped");
    await page.getByRole("button", { name: "Add Item" }).click();
    await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill("E2E Expired Bread");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect.poll(outboxSize).toBe(1);

    // The server returns with the session already ended, before the page can reach it.
    await context.setOffline(true);
    await offline.transition("live");
    await endSessionOnServer(offline.baseURL, cookies);
    await context.setOffline(false);

    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fgroceries/, { timeout: 30_000 });
    await expect.poll(imagesKept).toBe(false);
    expect(await outboxSize()).toBe(1);

    await context.addCookies(await signIn(offline.baseURL, USER_A));
    await page.goto("/groceries");
    await expect.poll(outboxSize, { timeout: 30_000 }).toBe(0);
    await page.reload();
    await expect(page.getByText("E2E Expired Bread").first()).toBeVisible();
  } finally {
    await offline.transition("live");
    await context.close();
  }
});
