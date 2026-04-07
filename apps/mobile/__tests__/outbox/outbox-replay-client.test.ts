import { TRPCClientError } from "@trpc/client";
import { describe, expect, it, vi } from "vitest";

import type { OutboxReplayClient } from "../../src/lib/outbox/outbox-replay-client";
import type { OutboxItem } from "../../src/lib/outbox/outbox-types";
import { replayOutboxItem } from "../../src/lib/outbox/outbox-replay-client";

describe("outbox-replay-client", () => {
  it("replays persisted mutations through function-like tRPC proxy nodes", async () => {
    const mutate = vi.fn().mockResolvedValue({ ok: true });
    const importFromUrl = Object.assign(vi.fn(), { mutate });
    const recipes = Object.assign(vi.fn(), { importFromUrl });
    const client: OutboxReplayClient = Object.assign(vi.fn(), { recipes });
    const item: OutboxItem = {
      id: "item-proxy",
      path: "recipes.importFromUrl",
      input: '{"json":{"url":"https://example.com/recipe"}}',
      request: {
        operationId: "op-proxy",
        headers: {
          "x-operation-id": "op-proxy",
        },
      },
      createdAt: "2026-03-23T00:00:00.000Z",
      attempts: 0,
      nextRetryAt: null,
    };

    await expect(replayOutboxItem(client, item)).resolves.toBe(true);

    expect(mutate).toHaveBeenCalledWith(
      { url: "https://example.com/recipe" },
      {
        context: {
          operationId: "op-proxy",
          headers: {
            "x-operation-id": "op-proxy",
            "x-replay-origin": "mobile-outbox",
          },
          skipOutboxCapture: true,
        },
      }
    );
  });

  it("replays persisted mutations through the tRPC client with preserved metadata", async () => {
    const mutate = vi.fn().mockResolvedValue({ ok: true });
    const client: OutboxReplayClient = {
      recipes: {
        update: {
          mutate,
        },
      },
    };
    const item: OutboxItem = {
      id: "item-1",
      path: "recipes.update",
      input: '{"json":{"id":"recipe-1","title":"Updated"}}',
      request: {
        operationId: "op-123",
        headers: {
          "x-operation-id": "op-123",
          "x-replay-origin": "mobile-outbox",
        },
      },
      createdAt: "2026-03-23T00:00:00.000Z",
      attempts: 0,
      nextRetryAt: null,
    };

    await expect(replayOutboxItem(client, item)).resolves.toBe(true);

    expect(mutate).toHaveBeenCalledWith(
      { id: "recipe-1", title: "Updated" },
      {
        context: {
          operationId: "op-123",
          headers: {
            "x-operation-id": "op-123",
            "x-replay-origin": "mobile-outbox",
          },
          skipOutboxCapture: true,
        },
      }
    );
  });

  it("returns false when the mutation could not be delivered to the backend", async () => {
    const client: OutboxReplayClient = {
      groceries: {
        add: {
          mutate: vi.fn().mockRejectedValue(new TypeError("Network request failed")),
        },
      },
    };
    const item: OutboxItem = {
      id: "item-2",
      path: "groceries.add",
      input: '{"json":{"name":"Milk"}}',
      request: {
        operationId: null,
        headers: {},
      },
      createdAt: "2026-03-23T00:00:00.000Z",
      attempts: 1,
      nextRetryAt: null,
    };

    await expect(replayOutboxItem(client, item)).resolves.toBe(false);
  });

  it("returns true when the mutation was delivered but the backend rejected it", async () => {
    const deliveredError = new TRPCClientError("This recipe already exists or is being imported", {
      result: {
        error: {
          code: -32009,
          message: "This recipe already exists or is being imported",
          data: {
            code: "CONFLICT",
            httpStatus: 409,
            path: "recipes.importFromUrl",
          },
        },
      },
    });
    const client: OutboxReplayClient = {
      recipes: {
        importFromUrl: {
          mutate: vi.fn().mockRejectedValue(deliveredError),
        },
      },
    };
    const item: OutboxItem = {
      id: "item-delivered-error",
      path: "recipes.importFromUrl",
      input: '{"json":{"url":"https://example.com/recipe"}}',
      request: {
        operationId: "op-delivered",
        headers: {},
      },
      createdAt: "2026-03-23T00:00:00.000Z",
      attempts: 13,
      nextRetryAt: null,
    };

    await expect(replayOutboxItem(client, item)).resolves.toBe(true);
  });

  it("returns false when the mutation path is missing on the client", async () => {
    const client: OutboxReplayClient = {};
    const item: OutboxItem = {
      id: "item-3",
      path: "recipes.update",
      input: '{"json":{"id":"recipe-1"}}',
      request: {
        operationId: null,
        headers: {},
      },
      createdAt: "2026-03-23T00:00:00.000Z",
      attempts: 0,
      nextRetryAt: null,
    };

    await expect(replayOutboxItem(client, item)).resolves.toBe(false);
  });
});
