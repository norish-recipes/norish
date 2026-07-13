import { observable } from "@trpc/server/observable";
import { indexedDB } from "fake-indexeddb";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { QueuedDeliveryError } from "@norish/shared/lib/queued-delivery";

import { createWebOutboxLink } from "./outbox-link";
import { WebOutboxReplayCoordinator } from "./outbox-replay";
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
  });
});

describe("web mutation delivery integration", () => {
  it("survives a fresh repository instance between offline capture and reconnect", async () => {
    const repository = new WebOutboxRepository();
    const operationId = "operation-reload";
    const link = createWebOutboxLink({
      repository,
      getUserId: async () => SCOPE.userId,
      getBackendOrigin: () => SCOPE.backendOrigin,
    });
    const operation = {
      type: "mutation",
      path: "groceries.create",
      input: { id: "grocery-1", name: "Milk" },
      context: { operationId },
    } as never;

    await new Promise<void>((resolve, reject) => {
      link()({
        op: operation,
        next: () =>
          observable((observer) => {
            observer.error(new TypeError("Failed to fetch"));
          }),
      } as never).subscribe({
        error: (error) => {
          try {
            expect(error).toBeInstanceOf(QueuedDeliveryError);
            resolve();
          } catch (assertionError) {
            reject(assertionError);
          }
        },
      });
    });

    const reloadedRepository = new WebOutboxRepository();
    const [entry] = await reloadedRepository.listPending(SCOPE);
    expect(entry?.operationId).toBe(operationId);

    await new WebOutboxReplayCoordinator({
      repository: reloadedRepository,
      getScope: async () => SCOPE,
      deliver: async (_entry, input) => ({ success: true, input }),
    }).start();

    expect(await reloadedRepository.list(SCOPE)).toEqual([]);
  });

  it("surfaces a local storage failure instead of claiming or implying queued delivery", async () => {
    const storageError = new WebOutboxStorageError("IndexedDB is unavailable");
    const repository = {
      enqueue: vi.fn().mockRejectedValue(storageError),
    } as unknown as WebOutboxRepository;
    const link = createWebOutboxLink({
      repository,
      getUserId: async () => SCOPE.userId,
      getBackendOrigin: () => SCOPE.backendOrigin,
    });

    const observedError = await new Promise<unknown>((resolve) => {
      link()({
        op: {
          type: "mutation",
          path: "groceries.create",
          input: { id: "grocery-1" },
          context: { operationId: "operation-storage-failure" },
        } as never,
        next: () =>
          observable((observer) => {
            observer.error(new TypeError("Failed to fetch"));
          }),
      } as never).subscribe({ error: resolve });
    });

    expect(observedError).toBe(storageError);
    expect(repository.enqueue).toHaveBeenCalledOnce();
  });

  it("does not repeat a logical effect after a lost first response", async () => {
    const repository = new WebOutboxRepository();
    const entry = await repository.enqueue({
      ...SCOPE,
      operationId: "operation-lost-response",
      path: "recipes.create",
      input: { id: "recipe-1" },
    });
    let effectCount = 0;
    let firstAttempt = true;
    const deliver = vi.fn(async () => {
      if (firstAttempt) {
        firstAttempt = false;
        effectCount += 1;
        throw new TypeError("Failed to fetch");
      }

      return { success: true, id: "recipe-1" };
    });
    const coordinator = new WebOutboxReplayCoordinator({
      repository,
      getScope: async () => SCOPE,
      deliver,
      maxBackoffMs: 0,
    });

    await coordinator.start();
    await coordinator.start();

    expect(effectCount).toBe(1);
    expect(deliver).toHaveBeenCalledTimes(2);
    expect((await repository.list(SCOPE)).find((item) => item.id === entry.id)).toBeUndefined();
  });
});
