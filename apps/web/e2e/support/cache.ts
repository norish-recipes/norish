import type { Page } from "@playwright/test";
import { PRIMARY_GROCERY_NAME, PRIMARY_RECIPE_NAME, PRIMARY_STORE_NAME } from "@/e2e/support/api";
import { expect } from "@playwright/test";

export type BrowserReadCacheSnapshot = {
  scopes: Array<{
    key: string;
    backendOrigin: string;
    userId: string;
    active: boolean;
    renderUser?: { email?: string };
  }>;
  records: Array<{
    id: string;
    scopeKey: string;
    kind: string;
    dataUpdatedAt: number;
    persistedAt: number;
    data: unknown;
  }>;
};

export async function readBrowserReadCache(page: Page): Promise<BrowserReadCacheSnapshot> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("norish-web-read-cache");

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(["scopes", "records"], "readonly");
    const readAll = <T>(store: string) =>
      new Promise<T[]>((resolve, reject) => {
        const request = transaction.objectStore(store).getAll();

        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      });
    const [scopes, records] = await Promise.all([
      readAll<BrowserReadCacheSnapshot["scopes"][number]>("scopes"),
      readAll<BrowserReadCacheSnapshot["records"][number]>("records"),
    ]);

    database.close();

    return { scopes, records };
  });
}

export async function waitForReadCacheKinds(page: Page, kinds: string[]) {
  await expect
    .poll(async () => {
      const snapshot = await readBrowserReadCache(page);

      return [...new Set(snapshot.records.map((record) => record.kind))].sort();
    })
    .toEqual([...kinds].sort());
}

export async function waitForStableReadCache(page: Page): Promise<BrowserReadCacheSnapshot> {
  let previous = await readBrowserReadCache(page);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await page.waitForTimeout(350);
    const current = await readBrowserReadCache(page);
    const metadata = (snapshot: BrowserReadCacheSnapshot) =>
      snapshot.records.map(({ id, dataUpdatedAt, persistedAt }) => ({
        id,
        dataUpdatedAt,
        persistedAt,
      }));

    if (JSON.stringify(metadata(current)) === JSON.stringify(metadata(previous))) return current;
    previous = current;
  }

  throw new Error("The browser read cache did not settle after its write throttle window");
}

export async function warmPrimaryReadCache(page: Page) {
  await page.goto("/");
  await expect(page.getByText(PRIMARY_RECIPE_NAME, { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL("/calendar");
  await expect(page.getByText(PRIMARY_RECIPE_NAME, { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "Groceries", exact: true }).click();
  await expect(page).toHaveURL("/groceries");
  await expect(page.getByText(PRIMARY_GROCERY_NAME, { exact: true })).toBeVisible();
  await expect(page.getByText(PRIMARY_STORE_NAME, { exact: true })).toBeVisible();

  await waitForReadCacheKinds(page, ["recipe-dashboard", "calendar-range", "groceries", "stores"]);
}

export async function openOfflineStatus(page: Page) {
  const userMenu = page.getByLabel("Open user menu").first();

  await userMenu.click();
  const trigger = page.getByRole("button", { name: /^Offline status:/ });

  await trigger.click();
  await expect(page.getByRole("heading", { name: "Offline status" })).toBeVisible();
}
