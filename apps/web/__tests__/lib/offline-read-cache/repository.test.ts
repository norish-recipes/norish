import type { QueryKey } from "@tanstack/react-query";
import {
  openWebReadCacheDatabase,
  requestResult,
  waitForTransaction,
  WEB_READ_CACHE_INDEXES,
  WEB_READ_CACHE_STORES,
} from "@/lib/offline-read-cache/database";
import { subscribeToWebReadCacheChanges } from "@/lib/offline-read-cache/events";
import {
  toWebReadCachePersistenceWarning,
  WebReadCacheRepository,
} from "@/lib/offline-read-cache/repository";
import {
  createWebReadCacheScopeKey,
  WEB_READ_CACHE_DATABASE_NAME,
  WEB_READ_CACHE_DATABASE_VERSION,
} from "@/lib/offline-read-cache/types";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";

const backendOrigin = "https://norish.test";

function scopeInput(userId: string, householdId: string) {
  return {
    backendOrigin,
    userId,
    householdId,
    renderUser: {
      id: userId,
      email: `${userId}@example.com`,
      name: userId,
      image: null,
      version: 1,
    },
    renderHousehold: { id: householdId, name: householdId },
    householdQueryKey: [["households", "get"], { type: "query" }] satisfies QueryKey,
  };
}

function deleteDatabase(factory: IDBFactory): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(WEB_READ_CACHE_DATABASE_NAME);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked"));
  });
}

describe("WebReadCacheRepository", () => {
  let factory: IDBFactory;
  let repository: WebReadCacheRepository;

  beforeEach(() => {
    factory = new IDBFactory();
    repository = new WebReadCacheRepository({ factory });
    vi.stubGlobal("IDBKeyRange", IDBKeyRange);
  });

  afterEach(async () => {
    await deleteDatabase(factory);
    vi.unstubAllGlobals();
  });

  it("creates separate scope and record stores on first open", async () => {
    const database = await openWebReadCacheDatabase({ factory });

    expect(database.version).toBe(WEB_READ_CACHE_DATABASE_VERSION);
    expect([...database.objectStoreNames]).toEqual(
      expect.arrayContaining([WEB_READ_CACHE_STORES.scopes, WEB_READ_CACHE_STORES.records])
    );
    database.close();
  });

  it("upgrades a legacy database without dropping its scopes", async () => {
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(WEB_READ_CACHE_DATABASE_NAME, 1);

      request.onupgradeneeded = () => {
        request.result.createObjectStore(WEB_READ_CACHE_STORES.scopes, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = legacy.transaction(WEB_READ_CACHE_STORES.scopes, "readwrite");

    transaction.objectStore(WEB_READ_CACHE_STORES.scopes).put({ key: "legacy" });
    await waitForTransaction(transaction);
    legacy.close();

    const upgraded = await openWebReadCacheDatabase({ factory });
    const read = upgraded.transaction(WEB_READ_CACHE_STORES.scopes, "readonly");

    expect(
      await requestResult(read.objectStore(WEB_READ_CACHE_STORES.scopes).get("legacy"))
    ).toEqual({ key: "legacy" });
    expect([...upgraded.objectStoreNames]).toContain(WEB_READ_CACHE_STORES.records);
    expect([
      ...upgraded
        .transaction(WEB_READ_CACHE_STORES.records, "readonly")
        .objectStore(WEB_READ_CACHE_STORES.records).indexNames,
    ]).toEqual(
      expect.arrayContaining([
        WEB_READ_CACHE_INDEXES.recordsByScope,
        WEB_READ_CACHE_INDEXES.recordsByScopeKind,
      ])
    );
    upgraded.close();
  });

  it("rejects a blocked upgrade and reports the blocked warning", async () => {
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(WEB_READ_CACHE_DATABASE_NAME, 1);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await expect(openWebReadCacheDatabase({ factory })).rejects.toMatchObject({ code: "blocked" });
    legacy.close();
  });

  it("isolates records by exact confirmed scope and selects only the last active scope", async () => {
    const first = await repository.confirmScope({
      ...scopeInput("user-a", "house-a"),
      confirmedAt: 10,
    });
    const second = await repository.confirmScope({
      ...scopeInput("user-b", "house-b"),
      confirmedAt: 20,
    });
    const key = [["groceries", "list"], { type: "query" }] satisfies QueryKey;

    await repository.putRecord({
      scopeKey: first.key,
      kind: "groceries",
      queryKey: key,
      data: { groceries: [{ id: "first" }] },
      dataUpdatedAt: 11,
    });
    await repository.putRecord({
      scopeKey: second.key,
      kind: "groceries",
      queryKey: key,
      data: { groceries: [{ id: "second" }] },
      dataUpdatedAt: 21,
    });

    expect((await repository.getRecord(first.key, key))?.data).toEqual({
      groceries: [{ id: "first" }],
    });
    expect((await repository.getRecord(second.key, key))?.data).toEqual({
      groceries: [{ id: "second" }],
    });
    expect((await repository.selectLastConfirmedScope(backendOrigin))?.key).toBe(second.key);
    expect(
      await repository.getCompatibleScope({
        backendOrigin,
        userId: "user-b",
        householdId: "different-house",
      })
    ).toBeNull();
  });

  it("preserves the previous complete record when a replacement transaction aborts", async () => {
    const scope = await repository.confirmScope(scopeInput("user", "house"));
    const queryKey = [
      ["recipes", "get"],
      { input: { id: "recipe" }, type: "query" },
    ] satisfies QueryKey;

    await repository.putRecord({
      scopeKey: scope.key,
      kind: "recipe-detail",
      queryKey,
      data: { id: "recipe", title: "last good" },
      dataUpdatedAt: 1,
    });

    const database = await openWebReadCacheDatabase({ factory });
    const transaction = database.transaction(WEB_READ_CACHE_STORES.records, "readwrite");
    const store = transaction.objectStore(WEB_READ_CACHE_STORES.records);
    const current = (await requestResult(store.getAll()))[0] as Record<string, unknown>;

    store.put({ ...current, data: { id: "recipe", title: "partial" } });
    transaction.abort();
    await expect(waitForTransaction(transaction)).rejects.toThrow();
    database.close();

    expect((await repository.getRecord(scope.key, queryKey))?.data).toEqual({
      id: "recipe",
      title: "last good",
    });
  });

  it("preserves last-good data and records a warning when a write cannot be cloned", async () => {
    const scope = await repository.confirmScope(scopeInput("user", "house"));
    const queryKey = [["stores", "list"], { type: "query" }] satisfies QueryKey;

    await repository.putRecord({
      scopeKey: scope.key,
      kind: "stores",
      queryKey,
      data: [{ id: "good" }],
      dataUpdatedAt: 1,
    });

    await expect(
      repository.putRecord({
        scopeKey: scope.key,
        kind: "stores",
        queryKey,
        data: { invalid: () => undefined },
        dataUpdatedAt: 2,
      })
    ).rejects.toThrow();

    expect((await repository.getRecord(scope.key, queryKey))?.data).toEqual([{ id: "good" }]);
    expect((await repository.getScope(scope.key))?.persistenceWarning?.code).toBe("write-failed");
    expect(
      toWebReadCachePersistenceWarning(new DOMException("full", "QuotaExceededError"), "stores")
    ).toMatchObject({ code: "quota-exceeded", recordKind: "stores" });
  });

  it("keeps the 50 most recently accessed recipe details without evicting canonical records", async () => {
    const scope = await repository.confirmScope(scopeInput("user", "house"));
    const dashboardKey = [
      ["recipes", "list"],
      { input: { limit: 100 }, type: "infinite" },
    ] satisfies QueryKey;

    await repository.putRecord({
      scopeKey: scope.key,
      kind: "recipe-dashboard",
      queryKey: dashboardKey,
      data: { pages: [{ recipes: [{ id: "summary" }] }] },
      dataUpdatedAt: 1,
      counts: { recipeSummaries: 1 },
      now: 1,
    });

    const detailKey = (index: number) =>
      [["recipes", "get"], { input: { id: `recipe-${index}` }, type: "query" }] satisfies QueryKey;

    for (let index = 0; index < 50; index += 1) {
      await repository.putRecord({
        scopeKey: scope.key,
        kind: "recipe-detail",
        queryKey: detailKey(index),
        data: { id: `recipe-${index}` },
        dataUpdatedAt: index + 2,
        counts: { recipeDetails: 1 },
        now: index + 2,
      });
    }

    await repository.getRecord(scope.key, detailKey(0), { touch: true, now: 1000 });
    await repository.putRecord({
      scopeKey: scope.key,
      kind: "recipe-detail",
      queryKey: detailKey(50),
      data: { id: "recipe-50" },
      dataUpdatedAt: 1001,
      counts: { recipeDetails: 1 },
      now: 1001,
    });

    const records = await repository.listRecords(scope.key);

    expect(records.filter((record) => record.kind === "recipe-detail")).toHaveLength(50);
    expect(await repository.getRecord(scope.key, detailKey(0))).not.toBeNull();
    expect(await repository.getRecord(scope.key, detailKey(1))).toBeNull();
    expect(await repository.getRecord(scope.key, dashboardKey)).not.toBeNull();
  });

  it("aggregates truthful inventory counts and timestamps", async () => {
    const scope = await repository.confirmScope({
      ...scopeInput("user", "house"),
      confirmedAt: 5,
      lastLiveSuccessAt: 5,
    });

    await repository.putRecord({
      scopeKey: scope.key,
      kind: "groceries",
      queryKey: [["groceries", "list"]],
      data: {},
      dataUpdatedAt: 20,
      now: 21,
      counts: { groceries: 4, recurringGroceries: 2, recipeNameMappings: 3 },
    });
    await repository.putRecord({
      scopeKey: scope.key,
      kind: "calendar-range",
      queryKey: [["calendar", "listItems"], { input: { startISO: "a", endISO: "b" } }],
      data: [],
      dataUpdatedAt: 30,
      now: 31,
      counts: { calendarItems: 6 },
    });

    expect(await repository.getInventory(scope.key)).toMatchObject({
      scopeKey: scope.key,
      lastLiveSuccessAt: 30,
      totalRecords: 2,
      groceries: { count: 4, dataUpdatedAt: 20, persistedAt: 21 },
      recurringGroceries: { count: 2, dataUpdatedAt: 20, persistedAt: 21 },
      calendarItems: { count: 6, dataUpdatedAt: 30, persistedAt: 31 },
    });
  });

  it("clears only the requested active scope and emits same-tab changes", async () => {
    const firstKey = createWebReadCacheScopeKey({
      backendOrigin,
      userId: "first",
      householdId: "house-one",
    });
    const first = await repository.confirmScope(scopeInput("first", "house-one"));
    const second = await repository.confirmScope(scopeInput("second", "house-two"));
    const events: string[] = [];
    const unsubscribe = subscribeToWebReadCacheChanges((change) => events.push(change.type));

    await repository.putRecord({
      scopeKey: first.key,
      kind: "stores",
      queryKey: [["stores", "list"]],
      data: [{ id: "one" }],
      dataUpdatedAt: 1,
    });
    await repository.putRecord({
      scopeKey: second.key,
      kind: "stores",
      queryKey: [["stores", "list"]],
      data: [{ id: "two" }],
      dataUpdatedAt: 2,
    });
    await repository.clearScope(second.key);
    unsubscribe();

    expect(first.key).toBe(firstKey);
    expect(await repository.listRecords(first.key)).toHaveLength(1);
    expect(await repository.listRecords(second.key)).toHaveLength(0);
    expect(events).toEqual(expect.arrayContaining(["commit", "clear"]));
  });

  it("removes the active render scope after confirmed sign-out", async () => {
    await repository.confirmScope(scopeInput("user", "house"));

    await repository.clearConfirmedRenderScope(backendOrigin);

    expect(await repository.selectLastConfirmedScope(backendOrigin)).toBeNull();
  });

  it("does not deactivate a replacement scope confirmed after sign-out was observed", async () => {
    await repository.confirmScope({ ...scopeInput("old-user", "old-house"), confirmedAt: 10 });
    const replacement = await repository.confirmScope({
      ...scopeInput("new-user", "new-house"),
      confirmedAt: 30,
    });

    await repository.clearConfirmedRenderScope(backendOrigin, 20);

    expect((await repository.selectLastConfirmedScope(backendOrigin))?.key).toBe(replacement.key);
  });
});
