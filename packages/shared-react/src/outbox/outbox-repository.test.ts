import { indexedDB } from "fake-indexeddb";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { DELIVERY_RETENTION_MS } from "@norish/shared/lib/delivery-retention";

import { openWebOutboxDatabase, OUTBOX_STORES } from "./database";
import { WebOutboxRepository, WebOutboxStorageError } from "./outbox-repository";

const DATABASE_NAME = "norish-web-mutation-delivery";
const SCOPE = { backendOrigin: "https://norish.test", userId: "user-1" };

beforeAll(() => {
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB delete was blocked"));
  });
});

describe("web outbox repository", () => {
  it("encrypts and round-trips JSON and binary payloads", async () => {
    const repository = new WebOutboxRepository();
    const input = new FormData();
    input.append("tag", "one");
    input.append("tag", "two");
    input.append("file", new File(["abc"], "notes.txt", { type: "text/plain", lastModified: 123 }));

    const entry = await repository.enqueue({
      ...SCOPE,
      operationId: "operation-json",
      path: "recipes.update",
      input: { date: new Date("2026-07-10T00:00:00Z"), values: new Map([["a", 1]]) },
    });
    const binaryEntry = await repository.enqueue({
      ...SCOPE,
      operationId: "operation-form",
      path: "archive.import",
      input,
    });

    expect(entry.encryptedInput.ciphertext.byteLength).toBeGreaterThan(0);
    expect(await repository.decodeInput(entry)).toEqual({
      date: new Date("2026-07-10T00:00:00Z"),
      values: new Map([["a", 1]]),
    });

    const decoded = (await repository.decodeInput(binaryEntry)) as FormData;
    expect(decoded.getAll("tag")).toEqual(["one", "two"]);
    const file = decoded.get("file");
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe("notes.txt");
    expect((file as File).lastModified).toBe(123);
    expect(await (file as File).text()).toBe("abc");
  });

  it("deduplicates by origin, user, operation, and path", async () => {
    const repository = new WebOutboxRepository();
    const first = await repository.enqueue({
      ...SCOPE,
      operationId: "operation-duplicate",
      path: "groceries.create",
      input: { id: "grocery-1" },
    });
    const duplicate = await repository.enqueue({
      ...SCOPE,
      operationId: "operation-duplicate",
      path: "groceries.create",
      input: { id: "different-input" },
    });

    expect(duplicate.id).toBe(first.id);
    expect(await repository.list(SCOPE)).toHaveLength(1);
  });

  it("quarantines other scopes, expires old entries, and supports discard", async () => {
    const repository = new WebOutboxRepository();
    const old = await repository.enqueue({
      ...SCOPE,
      operationId: "operation-old",
      path: "recipes.update",
      input: { id: "recipe-1" },
      now: 1,
    });
    const otherUser = await repository.enqueue({
      backendOrigin: SCOPE.backendOrigin,
      userId: "user-2",
      operationId: "operation-other",
      path: "recipes.update",
      input: { id: "recipe-2" },
    });
    const current = await repository.enqueue({
      ...SCOPE,
      operationId: "operation-current",
      path: "recipes.update",
      input: { id: "recipe-3" },
    });

    expect(await repository.quarantineMismatches(SCOPE)).toBe(1);
    expect((await repository.list())[1]?.state).toBe("quarantined");
    const pending = await repository.listPending(SCOPE, 1 + DELIVERY_RETENTION_MS);
    expect(pending.map((entry) => entry.id)).toEqual([current.id]);
    expect((await repository.list(SCOPE))[0]?.state).toBe("expired");
    expect(await repository.discard(current.id)).toBe(true);
    expect((await repository.list(SCOPE)).find((entry) => entry.id === current.id)?.state).toBe(
      "discarded"
    );
    expect(otherUser.userId).toBe("user-2");
    expect(old.createdAt).toBe(1);
  });

  it("retains encrypted completed results until explicit consumption", async () => {
    const repository = new WebOutboxRepository();
    const entry = await repository.enqueue({
      ...SCOPE,
      operationId: "operation-result",
      path: "user.apiKeys.create",
      input: { name: "automation" },
    });
    const response = { key: "secret-api-key", createdAt: new Date("2026-07-10T00:00:00Z") };

    await repository.markCompleted(entry, response);

    expect(await repository.list(SCOPE)).toEqual([]);
    const [result] = await repository.listResults(SCOPE);
    expect(result).toBeDefined();
    expect(result?.encryptedResponse.ciphertext.byteLength).toBeGreaterThan(0);
    expect(await repository.readResult(result!)).toEqual(response);
    expect(await repository.consumeResult(result!)).toEqual(response);
    expect(await repository.listResults(SCOPE)).toEqual([]);
  });

  it("deletes ordinary entries immediately after successful delivery", async () => {
    const repository = new WebOutboxRepository();
    const entry = await repository.enqueue({
      ...SCOPE,
      operationId: "operation-completed",
      path: "groceries.create",
      input: { id: "grocery-1", name: "Milk" },
    });

    await repository.markCompleted(entry);

    expect(await repository.list(SCOPE)).toEqual([]);
    expect(await repository.listResults(SCOPE)).toEqual([]);
  });

  it("rejects payloads that exceed the durable quota configured for the repository", async () => {
    const repository = new WebOutboxRepository(1);

    await expect(
      repository.enqueue({
        ...SCOPE,
        operationId: "operation-too-large",
        path: "archive.import",
        input: { payload: "too large" },
      })
    ).rejects.toBeInstanceOf(WebOutboxStorageError);
  });

  it("migrates an existing entries store with the operation dedupe index", async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        database.createObjectStore(OUTBOX_STORES.keys, { keyPath: "id" });
        const entries = database.createObjectStore(OUTBOX_STORES.entries, { keyPath: "id" });
        entries.createIndex("creationOrder", "creationOrder");
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    const database = await openWebOutboxDatabase();

    expect(
      database.transaction(OUTBOX_STORES.entries, "readonly").objectStore(OUTBOX_STORES.entries)
        .indexNames
    ).toContain("operationKey");
    database.close();
  });
});
