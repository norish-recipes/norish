/**
 * Backend-down browser suite (ADR-0009): production build, installed service
 * worker, real IndexedDB and Cache Storage, with the backend genuinely
 * stopped for the offline phases. Serial by design — the tests share one
 * browser context (one origin profile) and one server lifecycle.
 */
import type { BrowserContext, Page } from "@playwright/test";
import { expect, request, test } from "@playwright/test";

import type { E2eServer } from "./server";
import {
  E2E_BASE_URL,
  SEEDED_GROCERY_NAME,
  SEEDED_NOTE_TITLE,
  SEEDED_RECIPE_ID,
  SEEDED_RECIPE_IMAGE,
  SEEDED_RECIPE_NAME,
  UNWARMED_RECIPE_ID,
  USER_A,
  USER_B,
} from "./env";
import { startServer } from "./server";

test.describe.configure({ mode: "serial" });

let server: E2eServer | null = null;
let context: BrowserContext;
let page: Page;
let cookiesA: Awaited<ReturnType<BrowserContext["cookies"]>>;
let cookiesB: Awaited<ReturnType<BrowserContext["cookies"]>>;

async function apiSignIn(user: { email: string; password: string }) {
  const api = await request.newContext({
    baseURL: E2E_BASE_URL,
    // Better Auth rejects auth POSTs without a trusted Origin.
    extraHTTPHeaders: { origin: E2E_BASE_URL },
  });
  const response = await api.post("/api/auth/sign-in/email", {
    data: { email: user.email, password: user.password },
  });

  expect(response.ok(), `sign-in for ${user.email}`).toBeTruthy();
  const state = await api.storageState();

  await api.dispose();

  return state.cookies;
}

/** All Outbox entries in the page's IndexedDB, FIFO. */
function readOutbox(target: Page) {
  return target.evaluate(
    () =>
      new Promise<Array<{ ownerId: string; path: string; status: string }>>((resolve) => {
        const open = indexedDB.open("norish-offline");

        open.onsuccess = () => {
          const db = open.result;

          if (!db.objectStoreNames.contains("outbox")) {
            db.close();
            resolve([]);

            return;
          }

          const req = db.transaction("outbox", "readonly").objectStore("outbox").getAll();

          req.onsuccess = () => {
            db.close();
            resolve(req.result as Array<{ ownerId: string; path: string; status: string }>);
          };
          req.onerror = () => {
            db.close();
            resolve([]);
          };
        };
        open.onerror = () => resolve([]);
      })
  );
}

async function addGroceryViaUi(target: Page, name: string) {
  await target.getByRole("button", { name: "Add Item" }).click();
  await target.getByPlaceholder("e.g., 2 lbs chicken breast").fill(name);
  await target.getByRole("button", { name: "Add", exact: true }).click();
  await expect(target.getByText(name).first()).toBeVisible();
}

async function useCookies(cookies: typeof cookiesA) {
  await context.clearCookies();
  await context.addCookies(cookies);
}

test.beforeAll(async ({ browser }) => {
  server = await startServer();
  cookiesA = await apiSignIn(USER_A);
  cookiesB = await apiSignIn(USER_B);
  context = await browser.newContext({ baseURL: E2E_BASE_URL });
  await useCookies(cookiesA);
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
  await server?.stop().catch(() => undefined);
});

test("a Live visit installs the app shell and warms the Warm Set", async () => {
  // /settings is deliberately NOT a Warm Set surface: every later offline
  // navigation below is a genuinely unseen route in this browser profile.
  await page.goto("/settings");

  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, undefined, {
    timeout: 60_000,
  });

  // The Cache Warmer runs on the first Live render; the warmed recipe's
  // primary image landing in the bounded image cache marks completion.
  await expect
    .poll(
      () =>
        page.evaluate(async (imageUrl) => {
          const cache = await caches.open("norish-images");

          return (await cache.match(imageUrl)) !== undefined;
        }, SEEDED_RECIPE_IMAGE),
      { timeout: 60_000 }
    )
    .toBe(true);
});

test("backend-down unseen navigation boots every Warm Set surface", async () => {
  await server?.stop();
  server = null;

  // Dashboard.
  await page.goto("/");
  await expect(page.getByText(SEEDED_RECIPE_NAME).first()).toBeVisible();
  await expect(page.getByText(SEEDED_NOTE_TITLE).first()).toBeVisible();

  // Warmed recipe detail, with its primary image served from Cache Storage.
  await page.goto(`/recipes/${SEEDED_RECIPE_ID}`);
  await expect(page.getByText(SEEDED_RECIPE_NAME).first()).toBeVisible();
  const image = page.locator(`img[src*="${SEEDED_RECIPE_ID}"]`).first();

  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate(
        (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0
      )
    )
    .toBe(true);

  // Groceries and calendar.
  await page.goto("/groceries");
  await expect(page.getByText(SEEDED_GROCERY_NAME).first()).toBeVisible();
  await page.goto("/calendar");
  await expect(page.getByText(SEEDED_NOTE_TITLE).first()).toBeVisible();

  // Unwarmed recipe id and unsupported route: the explicit unavailable state.
  await page.goto(`/recipes/${UNWARMED_RECIPE_ID}`);
  await expect(page.getByTestId("offline-unavailable")).toBeVisible();
  await page.goto("/import");
  await expect(page.getByTestId("offline-unavailable")).toBeVisible();
});

test("an offline grocery toggle survives navigation and a document cold launch", async () => {
  await page.goto("/groceries");
  const groceryCheckbox = page.getByRole("checkbox", { name: SEEDED_GROCERY_NAME });

  await expect(groceryCheckbox).not.toBeChecked();
  await groceryCheckbox.press("Space");
  await expect(groceryCheckbox).toBeChecked();
  await expect.poll(() => readOutbox(page)).toHaveLength(1);

  await page.goto("/calendar");
  await page.goto("/groceries");
  await expect(page.getByRole("checkbox", { name: SEEDED_GROCERY_NAME })).toBeChecked();

  await page.reload();
  await expect(page.getByRole("checkbox", { name: SEEDED_GROCERY_NAME })).toBeChecked();

  const [entry] = await readOutbox(page);

  expect(entry?.path).toBe("groceries.toggle");
  expect(entry?.status).toBe("pending");
});

test("an offline grocery add is durably queued for its owner", async () => {
  await page.goto("/groceries");
  await addGroceryViaUi(page, "E2E Dormant Milk");

  await expect.poll(() => readOutbox(page)).toHaveLength(2);
  const entry = (await readOutbox(page)).find(({ path }) => path === "groceries.create");

  expect(entry?.path).toBe("groceries.create");
  expect(entry?.status).toBe("pending");
});

test("a bypassed identity change isolates the incoming account and keeps the queue dormant", async () => {
  await useCookies(cookiesB);
  server = await startServer();

  await page.goto("/groceries");

  // B's session boots the app Live (fresh account, so the page itself may
  // stay in its empty/loading state) and none of A's data is visible — not
  // the seeded grocery, not the queued one.
  await expect(page.getByRole("button", { name: "Open user menu" })).toBeVisible();
  await expect(page.getByText(SEEDED_GROCERY_NAME)).toHaveCount(0);
  await expect(page.getByText("E2E Dormant Milk")).toHaveCount(0);

  // A's entries are retained dormant under A — never replayed as B.
  const entries = await readOutbox(page);

  expect(entries).toHaveLength(2);
  expect(entries.map(({ path }) => path)).toEqual(["groceries.toggle", "groceries.create"]);
});

test("the dormant queue replays only once its owner signs in again", async () => {
  await useCookies(cookiesA);
  await page.goto("/groceries");

  // Reconnect sequence as A: the dormant create drains from the queue…
  await expect.poll(() => readOutbox(page), { timeout: 30_000 }).toHaveLength(0);

  // …and landed on the server, not just in optimistic state: a fresh load
  // shows it from server truth.
  await page.reload();
  await expect(page.getByText("E2E Dormant Milk").first()).toBeVisible();
});

/**
 * A Parked entry is the stable "unsynced work while Live" state (it never
 * auto-replays), exactly what survives a reconnect after retries exhausted.
 */
function injectParkedEntry(target: Page) {
  return target.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const owner = localStorage.getItem("norish.offline.cache-owner");

        if (!owner) {
          reject(new Error("no boot owner"));

          return;
        }

        const open = indexedDB.open("norish-offline");

        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("outbox", "readwrite");

          tx.objectStore("outbox").add({
            id: crypto.randomUUID(),
            ownerId: owner,
            path: "groceries.toggle",
            input: { groceries: [{ id: crypto.randomUUID(), version: 1 }], isDone: true },
            entityId: null,
            operationId: null,
            headers: {},
            createdAt: new Date().toISOString(),
            attempts: 3,
            status: "parked",
            parkedReason: "retries-exhausted",
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error ?? new Error("tx failed"));
          };
        };
        open.onerror = () => reject(open.error ?? new Error("open failed"));
      })
  );
}

test("sign-out with unsynced work asks first; Cancel preserves everything", async () => {
  await injectParkedEntry(page);
  await expect.poll(() => readOutbox(page)).toHaveLength(1);

  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByRole("menuitem", { name: "Logout" }).click();
  await expect(page.getByText("Discard unsynced changes?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Discard unsynced changes?")).toHaveCount(0);

  // Session, queue, and caches stay exactly as they were.
  await expect.poll(() => readOutbox(page)).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Open user menu" })).toBeVisible();
});

test("a confirmed sign-out discards the queue and completes", async () => {
  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByRole("menuitem", { name: "Logout" }).click();
  await expect(page.getByText("Discard unsynced changes?")).toBeVisible();
  await page.getByRole("button", { name: "Logout", exact: true }).click();

  await page.waitForURL("**/login**", { timeout: 30_000 });

  // The queue was discarded and the personalized caches are gone.
  await expect.poll(() => readOutbox(page)).toHaveLength(0);
  await expect.poll(() => page.evaluate(() => caches.has("norish-images"))).toBe(false);
});
