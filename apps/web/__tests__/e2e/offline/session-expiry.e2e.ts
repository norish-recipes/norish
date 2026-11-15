/**
 * Session Expiry (CONTEXT.md): the server ends a session the reader did not end. The device
 * forgets the Offline Cache, keeps the Outbox, and replays it once the same reader signs in.
 */
import type { BrowserContext, Page } from "@playwright/test";
import { request } from "@playwright/test";

import type { OfflineHarness, SessionCookies } from "./fixture";
import { signIn } from "../harness/auth";
import {
  expect,
  persistedReadsHold,
  readOutbox,
  SEEDED_GROCERY_NAME,
  SEEDED_RECIPE_IMAGE,
  test,
  USER_A,
} from "./fixture";

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

const outboxSize = async (page: Page) => (await readOutbox(page)).length;
const imagesKept = (page: Page) => page.evaluate(() => caches.has("norish-images"));

/** A's groceries warmed into the Offline Cache, then one change queued while the server is down. */
async function queueWhileStopped(page: Page, offline: OfflineHarness, name: string): Promise<void> {
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
  await expect.poll(() => persistedReadsHold(page, SEEDED_GROCERY_NAME)).toBe(true);

  await offline.transition("stopped");
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill(name);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect.poll(() => outboxSize(page)).toBe(1);
}

/** On sign-in with the session ended: the Offline Cache is gone and the queued change is kept. */
async function expectForgottenAndKept(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fgroceries/, { timeout: 30_000 });
  await expect.poll(() => imagesKept(page)).toBe(false);
  await expect.poll(() => persistedReadsHold(page, SEEDED_GROCERY_NAME)).toBe(false);
  expect(await outboxSize(page)).toBe(1);
}

/** The same reader signs in again and the queued change replays. */
async function expectReplayedForReader(
  context: BrowserContext,
  page: Page,
  baseURL: string,
  name: string
): Promise<void> {
  await context.addCookies(await signIn(baseURL, USER_A));
  await page.goto("/groceries");
  await expect.poll(() => outboxSize(page), { timeout: 30_000 }).toBe(0);
  await page.reload();
  await expect(page.getByText(name).first()).toBeVisible();
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

    await queueWhileStopped(page, offline, "E2E Expired Bread");

    // The server returns with the session already ended, before the page can reach it.
    await context.setOffline(true);
    await offline.transition("live");
    await endSessionOnServer(offline.baseURL, cookies);
    await context.setOffline(false);

    await expectForgottenAndKept(page);
    await expectReplayedForReader(context, page, offline.baseURL, "E2E Expired Bread");
  } finally {
    await offline.transition("live");
    await context.close();
  }
});

test("opening the app on an expired session clears the Offline Cache before sign-in", async ({
  browser,
  offlineHarness: offline,
}) => {
  const cookies = await signIn(offline.baseURL, USER_A);
  const context = await browser.newContext({ baseURL: offline.baseURL, serviceWorkers: "allow" });

  try {
    await context.addCookies(cookies);
    const warmed = await context.newPage();

    await queueWhileStopped(warmed, offline, "E2E Next Day Bread");
    // No service worker, so the cached document cannot answer for the server.
    await warmed.evaluate(async () => {
      for (const registration of await navigator.serviceWorker.getRegistrations()) {
        await registration.unregister();
      }
    });
    // Closed before the server returns, so only a fresh load meets the ended session.
    await warmed.close();
    await offline.transition("live");
    await endSessionOnServer(offline.baseURL, cookies);

    const page = await context.newPage();

    // The server sees no session and redirects before any of the app's code runs.
    const response = await page.goto("/groceries");

    expect(response?.fromServiceWorker()).toBe(false);
    expect(response?.request().redirectedFrom()?.url()).toMatch(/\/groceries$/);
    await expectForgottenAndKept(page);
    await expectReplayedForReader(context, page, offline.baseURL, "E2E Next Day Bread");
  } finally {
    await offline.transition("live");
    await context.close();
  }
});
