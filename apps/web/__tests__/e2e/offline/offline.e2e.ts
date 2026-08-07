/**
 * Backend-down browser suite (ADR-0009): production build, installed service
 * worker, real IndexedDB and Cache Storage, with the backend genuinely
 * stopped for the offline phases. Serial by design — the tests share one
 * browser context (one origin profile) and one server lifecycle.
 */
import type { Page } from "@playwright/test";

import type { OfflineHarness } from "./fixture";
import {
  expect,
  SEEDED_GROCERY_NAME,
  SEEDED_NOTE_TITLE,
  SEEDED_RECIPE_ID,
  SEEDED_RECIPE_IMAGE,
  SEEDED_RECIPE_NAME,
  test,
  UNWARMED_RECIPE_ID,
} from "./fixture";

test.describe.configure({ mode: "serial" });

let offline: OfflineHarness;
let page: Page;

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

test.beforeAll(async ({ offlineHarness }) => {
  offline = offlineHarness;
  page = offline.page;
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
  await offline.transition("stopped");

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

  // Do not hand the next serial scenario an OfflineUnavailable page: when it
  // restores Live, that component intentionally reloads its own URL and can
  // race the next scenario's navigation. Park on a cached Warm Set surface.
  await page.goto("/");
  await expect(page.getByText(SEEDED_RECIPE_NAME).first()).toBeVisible();
});

test("a hanging network observes the Reachability Deadline (ADR-0013)", async () => {
  // Before the deadline handler, this scenario hung on whatever was on screen
  // indefinitely: NetworkFirst had no timeout for documents and the fallback
  // only fired on a network *error*, which a crawling network never raises.
  //
  // Cache one real document under service-worker control first: the suite's
  // initial Live visit predates the worker claiming the page, so the pages
  // cache is still empty.
  await offline.transition("live");
  await page.goto("/settings");
  await offline.transition("unresponsive");

  // An uncached route must fail over to the offline shell at the deadline.
  let startedAt = Date.now();

  await page.goto("/import");
  await expect(page.getByTestId("offline-unavailable")).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(20_000);

  // A route visited while Live serves its cached document at the deadline
  // instead of the shell.
  startedAt = Date.now();
  await page.goto("/settings");
  expect(Date.now() - startedAt).toBeLessThan(20_000);
  await expect(page.getByTestId("offline-unavailable")).not.toBeVisible();

  await offline.transition("stopped");

  // Park on a Warm Set surface so no auto-reload candidate is mounted when a
  // later test brings the backend back.
  await page.goto("/");
});

test("the Offline-unavailable card reloads its page once when Live returns", async () => {
  // Parked on an unwarmed recipe with the backend down…
  await page.goto(`/recipes/${UNWARMED_RECIPE_ID}`);
  await expect(page.getByTestId("offline-unavailable")).toBeVisible();

  // …the backend returning must resolve the dead end without any user action:
  // the card reloads the originally requested URL once. The id is not seeded,
  // so the Live render is the recipe's not-found state — what matters is that
  // the offline card is gone without a manual reload.
  await offline.transition("live");
  await expect(page.getByTestId("offline-unavailable")).toBeHidden({ timeout: 90_000 });

  // The reload spent its once-per-path shot and recorded it.
  await expect
    .poll(() =>
      page.evaluate(
        (id) => sessionStorage.getItem(`norish.offline-unavailable.reloaded:/recipes/${id}`),
        UNWARMED_RECIPE_ID
      )
    )
    .toBe("1");

  await offline.transition("stopped");
});

test("an offline grocery toggle survives navigation and a document cold launch", async () => {
  // Visit /groceries once while Live first. That is what a real user does, and
  // it is what gives this test teeth: the page's own query batch is a
  // same-origin GET, so any HTTP-level cache the worker keeps now holds a
  // pre-toggle copy of it, ready to answer the next Offline refetch with a
  // stale success. See ADR-0006.
  await offline.transition("live");
  await page.goto("/groceries");
  await expect(page.getByText(SEEDED_GROCERY_NAME).first()).toBeVisible();
  await offline.transition("stopped");

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

test("no Offline API read is answered from a stale cache", async () => {
  // The cause behind the test above, asserted deterministically: whether the
  // revert reproduces through the UI depends on which query batch URLs the
  // worker happens to hold, which is why the suite missed it for so long.
  //
  // Offline reads come from the persisted query cache (ADR-0001). An HTTP-level
  // copy of the same responses is both a second source of truth and a liar: it
  // turns a failed Offline refetch into a *success* carrying pre-mutation data,
  // and it would answer the connectivity probe with a cached 200. With the
  // backend down, no API GET may be answered by anything.
  const { cachedApiUrls, otherCachedEntries, answered } = await page.evaluate(async () => {
    const cachedApiUrls: string[] = [];
    let otherCachedEntries = 0;

    for (const name of await caches.keys()) {
      const cache = await caches.open(name);

      for (const request of await cache.keys()) {
        if (new URL(request.url).pathname.startsWith("/api/")) {
          cachedApiUrls.push(request.url);
        } else {
          otherCachedEntries += 1;
        }
      }
    }

    const outcomes = await Promise.all(
      cachedApiUrls.map(async (url) => {
        try {
          const response = await fetch(url);

          return `${new URL(url).pathname} answered ${response.status}`;
        } catch {
          return null;
        }
      })
    );

    return {
      cachedApiUrls,
      otherCachedEntries,
      answered: outcomes.filter((outcome) => outcome !== null),
    };
  });

  // Arming check: an empty API set only means something if the worker is
  // caching at all. Without this, a change that stopped the suite exercising
  // the worker would leave the assertion below passing on nothing.
  expect(otherCachedEntries).toBeGreaterThan(0);
  expect(cachedApiUrls).toEqual([]);
  expect(answered).toEqual([]);
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
  await offline.selectIdentity("b");
  await offline.transition("live");

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
  await offline.selectIdentity("a");
  await page.goto("/groceries");

  // Reconnect sequence as A: the dormant create drains from the queue…
  await expect.poll(() => readOutbox(page), { timeout: 30_000 }).toHaveLength(0);

  // …and landed on the server, not just in optimistic state: a fresh load
  // shows it from server truth.
  await page.reload();
  await expect(page.getByText("E2E Dormant Milk").first()).toBeVisible();
  // Same for the queued toggle: the row is done because the server says so, so
  // the Offline check-off survived the whole round trip and applied once.
  await expect(page.getByRole("checkbox", { name: SEEDED_GROCERY_NAME })).toBeChecked();
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
