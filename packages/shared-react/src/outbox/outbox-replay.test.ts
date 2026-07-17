import { describe, expect, it, vi } from "vitest";

import type { WebOutboxRepository } from "./outbox-repository";
import type { WebOutboxEntry } from "./outbox-types";
import { WebOutboxReplayCoordinator } from "./outbox-replay";
import { WEB_OUTBOX_SCHEMA_VERSION } from "./outbox-types";

function createEntry(id: string, creationOrder: number): WebOutboxEntry {
  return {
    schemaVersion: WEB_OUTBOX_SCHEMA_VERSION,
    id,
    backendOrigin: "https://norish.test",
    userId: "user-1",
    operationId: `operation-${id}`,
    path: "groceries.update",
    payloadKind: "superjson",
    encryptedInput: { iv: new ArrayBuffer(0), ciphertext: new ArrayBuffer(0) },
    createdAt: creationOrder,
    creationOrder,
    attempts: 0,
    nextRetryAt: null,
    state: "pending",
    expiresAt: creationOrder + 1_000_000,
  };
}

function fakeRepository(entries: WebOutboxEntry[]) {
  return {
    quarantineMismatches: vi.fn(async () => 0),
    listPending: vi.fn(async () => entries),
    decodeInput: vi.fn(async () => ({ ok: true })),
    update: vi.fn(async () => true),
    markCompleted: vi.fn(async () => undefined),
  } as unknown as WebOutboxRepository;
}

describe("web outbox replay coordinator", () => {
  it("coalesces overlapping startup and reconnect passes", async () => {
    const entries = [createEntry("first", 1)];
    const repository = fakeRepository(entries);
    let releaseDelivery!: () => void;
    const deliveryFinished = new Promise<void>((resolve) => {
      releaseDelivery = resolve;
    });
    const deliver = vi.fn(async () => {
      await deliveryFinished;
      return { success: true };
    });
    const refetch = vi.fn(async () => undefined);
    const coordinator = new WebOutboxReplayCoordinator({
      repository,
      getScope: async () => ({ backendOrigin: "https://norish.test", userId: "user-1" }),
      deliver,
      refetch,
    });

    const first = coordinator.start();
    const second = coordinator.start();

    expect(second).toBe(first);
    releaseDelivery();
    await Promise.all([first, second]);

    expect(deliver).toHaveBeenCalledOnce();
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("blocks later entries when the head item is unreachable", async () => {
    const entries = [createEntry("first", 1), createEntry("second", 2)];
    const repository = fakeRepository(entries);
    const deliver = vi.fn(async () => {
      throw new Error("Failed to fetch");
    });

    await new WebOutboxReplayCoordinator({
      repository,
      getScope: async () => ({ backendOrigin: "https://norish.test", userId: "user-1" }),
      deliver,
    }).start();

    expect(deliver).toHaveBeenCalledOnce();
    expect(deliver).toHaveBeenCalledWith(entries[0], { ok: true });
    expect(repository.update).toHaveBeenCalledWith(
      "first",
      expect.objectContaining({ state: "retrying", attempts: 1 })
    );
  });

  it("does not refetch away optimistic state after an unreachable replay", async () => {
    const repository = fakeRepository([createEntry("first", 1)]);
    const refetch = vi.fn(async () => undefined);

    await new WebOutboxReplayCoordinator({
      repository,
      getScope: async () => ({ backendOrigin: "https://norish.test", userId: "user-1" }),
      deliver: async () => {
        throw new TypeError("Failed to fetch");
      },
      refetch,
    }).start();

    expect(refetch).not.toHaveBeenCalled();
  });

  it("forces backed-off entries on an explicit recovery before refetching", async () => {
    const entry = createEntry("first", 1);
    entry.state = "retrying";
    entry.nextRetryAt = Date.now() + 60_000;
    const repository = fakeRepository([entry]);
    const order: string[] = [];
    const coordinator = new WebOutboxReplayCoordinator({
      repository,
      getScope: async () => ({ backendOrigin: "https://norish.test", userId: "user-1" }),
      deliver: async () => {
        order.push("replay");

        return { success: true };
      },
      refetch: async () => {
        order.push("refetch");
      },
    });

    await coordinator.start({ forceRetry: true, refetchAfterPass: true });

    expect(order).toEqual(["replay", "refetch"]);
  });

  it("caps retry backoff while keeping later entries blocked", async () => {
    const entries = [createEntry("first", 1), createEntry("second", 2)];
    entries[0]!.attempts = 6;
    const repository = fakeRepository(entries);
    const deliver = vi.fn(async () => {
      throw new Error("Failed to fetch");
    });
    const before = Date.now();

    await new WebOutboxReplayCoordinator({
      repository,
      getScope: async () => ({ backendOrigin: "https://norish.test", userId: "user-1" }),
      deliver,
      maxBackoffMs: 123,
    }).start();

    const update = repository.update.mock.calls[0]?.[1] as {
      attempts: number;
      nextRetryAt: number;
    };
    expect(deliver).toHaveBeenCalledOnce();
    expect(update.attempts).toBe(7);
    expect(update.nextRetryAt).toBeGreaterThanOrEqual(before);
    expect(update.nextRetryAt).toBeLessThanOrEqual(Date.now() + 123);
  });

  it("continues after a terminal stale result", async () => {
    const entries = [createEntry("first", 1), createEntry("second", 2)];
    const repository = fakeRepository(entries);
    const deliver = vi
      .fn()
      .mockResolvedValueOnce({ stale: true })
      .mockResolvedValueOnce({ success: true });

    await new WebOutboxReplayCoordinator({
      repository,
      getScope: async () => ({ backendOrigin: "https://norish.test", userId: "user-1" }),
      deliver,
    }).start();

    expect(deliver).toHaveBeenCalledTimes(2);
    expect(repository.update).toHaveBeenCalledWith(
      "first",
      expect.objectContaining({ state: "terminal", lastErrorCode: "STALE_VERSION" })
    );
    expect(repository.markCompleted).toHaveBeenCalledWith(entries[1], undefined);
  });

  it("pauses on authentication loss and quarantines the head entry", async () => {
    const entries = [createEntry("first", 1), createEntry("second", 2)];
    const repository = fakeRepository(entries);
    const deliver = vi.fn(async () => {
      throw { data: { code: "UNAUTHORIZED" } };
    });

    await new WebOutboxReplayCoordinator({
      repository,
      getScope: async () => ({ backendOrigin: "https://norish.test", userId: "user-1" }),
      deliver,
    }).start();

    expect(deliver).toHaveBeenCalledOnce();
    expect(repository.update).toHaveBeenCalledWith(
      "first",
      expect.objectContaining({ state: "quarantined", lastErrorCode: "UNAUTHORIZED" })
    );
  });

  it("continues after a terminal domain error while refetching authoritative state", async () => {
    const entries = [createEntry("first", 1), createEntry("second", 2)];
    const repository = fakeRepository(entries);
    const deliver = vi
      .fn()
      .mockRejectedValueOnce(new Error("The recipe is no longer editable"))
      .mockResolvedValueOnce({ success: true });
    const refetch = vi.fn(async () => undefined);

    await new WebOutboxReplayCoordinator({
      repository,
      getScope: async () => ({ backendOrigin: "https://norish.test", userId: "user-1" }),
      deliver,
      refetch,
    }).start();

    expect(deliver).toHaveBeenCalledTimes(2);
    expect(repository.update).toHaveBeenCalledWith(
      "first",
      expect.objectContaining({ state: "terminal", lastErrorCode: "DOMAIN_ERROR" })
    );
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("classifies receipt conflicts distinctly from generic domain failures", async () => {
    const entries = [createEntry("first", 1)];
    const repository = fakeRepository(entries);

    await new WebOutboxReplayCoordinator({
      repository,
      getScope: async () => ({ backendOrigin: "https://norish.test", userId: "user-1" }),
      deliver: async () => {
        throw { data: { code: "CONFLICT" }, message: "operation ID was reused" };
      },
    }).start();

    expect(repository.update).toHaveBeenCalledWith(
      "first",
      expect.objectContaining({ state: "terminal", lastErrorCode: "CONFLICT" })
    );
  });

  it("retains only non-reconstructable one-time replay responses", async () => {
    const ordinary = createEntry("ordinary", 1);
    const secret = createEntry("secret", 2);
    secret.path = "user.apiKeys.create";
    const entries = [ordinary, secret];
    const repository = fakeRepository(entries);

    await new WebOutboxReplayCoordinator({
      repository,
      getScope: async () => ({ backendOrigin: "https://norish.test", userId: "user-1" }),
      deliver: async (entry) =>
        entry === secret ? { success: true, key: "one-time-key" } : { success: true },
    }).start();

    expect(repository.markCompleted).toHaveBeenNthCalledWith(1, ordinary, undefined);
    expect(repository.markCompleted).toHaveBeenNthCalledWith(2, secret, {
      success: true,
      key: "one-time-key",
    });
  });
});
