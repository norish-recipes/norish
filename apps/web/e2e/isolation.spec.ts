import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext } from "@playwright/test";
import { expect, test } from "@/e2e/fixtures";
import { SECONDARY_RECIPE_NAME } from "@/e2e/support/api";
import { SECONDARY_USER } from "@/e2e/support/auth";
import { openOfflineStatus, readBrowserReadCache, warmPrimaryReadCache } from "@/e2e/support/cache";

test("@critical keeps origin, user, and household read scopes isolated in one browser", async ({
  page,
  context,
}) => {
  await warmPrimaryReadCache(page);
  const primarySnapshot = await readBrowserReadCache(page);
  const primaryScope = primarySnapshot.scopes.find((scope) => scope.active);
  const secondaryStorageState = JSON.parse(
    await readFile(path.resolve("e2e/.auth/secondary.json"), "utf8")
  ) as Awaited<ReturnType<BrowserContext["storageState"]>>;

  expect(primaryScope).toBeTruthy();
  const primaryScopeKey = primaryScope?.key;

  expect(primaryScopeKey).toBeTruthy();
  await context.clearCookies();
  await context.addCookies(secondaryStorageState.cookies);

  await page.goto("/");
  await expect(page.getByText(SECONDARY_RECIPE_NAME, { exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const snapshot = await readBrowserReadCache(page);

      return snapshot.scopes
        .filter((scope) => scope.active)
        .map((scope) => scope.renderUser?.email)
        .sort();
    })
    .toEqual([SECONDARY_USER.email]);

  const primaryOnlyMarker = "E2E primary cache sentinel";

  await page.evaluate(
    async ({ scopeKey, marker }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("norish-web-read-cache");

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction("records", "readwrite");
      const store = transaction.objectStore("records");
      const records = await new Promise<
        Array<{
          id: string;
          scopeKey: string;
          kind: string;
          data: { pages?: Array<{ recipes?: Array<Record<string, unknown>> }> };
        }>
      >((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const dashboard = records.find(
        (record) => record.scopeKey === scopeKey && record.kind === "recipe-dashboard"
      );
      const recipes = dashboard?.data.pages?.[0]?.recipes;
      const firstRecipe = recipes?.[0];

      if (!dashboard || !recipes || !firstRecipe) {
        throw new Error("Primary dashboard cache record is missing");
      }
      recipes[0] = { ...firstRecipe, name: marker };
      store.put(dashboard);
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    { scopeKey: primaryScopeKey, marker: primaryOnlyMarker }
  );

  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("norish-web-read-cache");

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("scopes", "readwrite");

    transaction.objectStore("scopes").put({
      key: "foreign-origin-scope",
      backendOrigin: "https://foreign.example",
      userId: "foreign-user",
      householdId: "foreign-household",
      schemaVersion: 2,
      renderUser: {
        id: "foreign-user",
        email: "foreign@example.test",
        name: "Foreign user",
        image: null,
        version: 1,
      },
      renderHousehold: { id: "foreign-household", name: "Foreign household" },
      householdQueryKey: null,
      confirmedAt: Date.now() + 10_000,
      updatedAt: Date.now() + 10_000,
      lastLiveSuccessAt: Date.now(),
      persistenceWarning: null,
      active: true,
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.route("**/api/trpc/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.abort("failed");
  });
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => undefined);

  await expect(page.getByText(SECONDARY_RECIPE_NAME, { exact: true })).toBeVisible();
  await expect(page.getByText(primaryOnlyMarker, { exact: true })).toHaveCount(0);
  await expect(page.getByText("Foreign user", { exact: true })).toHaveCount(0);
});

test("@critical selects only the last confirmed household for the same offline user", async ({
  page,
}) => {
  await warmPrimaryReadCache(page);
  const originalMarker = "E2E original household cache";
  const currentMarker = "E2E current household cache";

  await page.evaluate(
    async ({ currentMarker, originalMarker }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("norish-web-read-cache");

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction(["scopes", "records"], "readwrite");
      const scopeStore = transaction.objectStore("scopes");
      const recordStore = transaction.objectStore("records");
      const scopes = await new Promise<
        Array<{
          key: string;
          backendOrigin: string;
          userId: string;
          active: boolean;
          confirmedAt: number;
          updatedAt: number;
        }>
      >((resolve, reject) => {
        const request = scopeStore.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const originalScope = scopes.find((scope) => scope.active);

      if (!originalScope) throw new Error("Active read-cache scope is missing");

      const records = await new Promise<
        Array<{
          id: string;
          scopeKey: string;
          queryIdentity: string;
          kind: string;
          data: { pages?: Array<{ recipes?: Array<Record<string, unknown>> }> };
        }>
      >((resolve, reject) => {
        const request = recordStore.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const householdId = "e2e-current-household";
      const currentScopeKey = JSON.stringify([
        2,
        originalScope.backendOrigin,
        originalScope.userId,
        householdId,
      ]);
      const now = Date.now();

      scopeStore.put({ ...originalScope, active: false, updatedAt: now });
      scopeStore.put({
        ...originalScope,
        key: currentScopeKey,
        householdId,
        renderHousehold: { id: householdId, name: "Current E2E household" },
        active: true,
        confirmedAt: now + 1,
        updatedAt: now + 1,
      });

      for (const record of records.filter(
        (candidate) => candidate.scopeKey === originalScope.key
      )) {
        const original = structuredClone(record);
        const current = structuredClone(record);
        const originalRecipe = original.data.pages?.[0]?.recipes?.[0];
        const currentRecipe = current.data.pages?.[0]?.recipes?.[0];

        if (record.kind === "recipe-dashboard" && originalRecipe && currentRecipe) {
          original.data.pages![0]!.recipes![0] = { ...originalRecipe, name: originalMarker };
          current.data.pages![0]!.recipes![0] = { ...currentRecipe, name: currentMarker };
        }

        recordStore.put(original);
        recordStore.put({
          ...current,
          id: `${currentScopeKey}:${current.queryIdentity}`,
          scopeKey: currentScopeKey,
        });
      }

      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    { currentMarker, originalMarker }
  );

  await page.route("**/api/trpc/**", (route) => route.abort("failed"));
  await page.goto("/", { waitUntil: "domcontentloaded" }).catch(() => undefined);

  await expect(page.getByText(currentMarker, { exact: true })).toBeVisible();
  await expect(page.getByText(originalMarker, { exact: true })).toHaveCount(0);
});

test("clears only the active household cache from the status modal", async ({ page }) => {
  await warmPrimaryReadCache(page);
  const before = await readBrowserReadCache(page);
  const activeScope = before.scopes.find((scope) => scope.active);

  expect(activeScope).toBeTruthy();
  expect(before.records.some((record) => record.scopeKey === activeScope?.key)).toBe(true);

  await openOfflineStatus(page);
  const modal = page.getByRole("dialog");

  await modal.getByRole("button", { name: "Clear saved data" }).click();
  await expect(
    modal.getByText("Clear saved data for the active household on this browser?")
  ).toBeVisible();
  await modal.getByRole("button", { name: "Clear saved data" }).click();
  await expect(modal.getByText("No offline data is saved for this household yet.")).toBeVisible();

  await expect
    .poll(async () => {
      const after = await readBrowserReadCache(page);

      return after.records.filter((record) => record.scopeKey === activeScope?.key).length;
    })
    .toBe(0);
});
