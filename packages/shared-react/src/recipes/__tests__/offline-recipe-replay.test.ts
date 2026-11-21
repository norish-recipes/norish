import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OutboxEntry } from "../../offline/outbox-types";
import { createOutboxStore } from "../../offline/outbox-store";
import { runReplayPass } from "../../offline/replay";
import { replayOutboxEntry } from "../../offline/replay-client";
import { createMemoryStorage } from "../../offline/testing/memory-storage";

// A failed recipe save rejects, so Replay treats it as any other failed write.
describe("replaying a recipe save", () => {
  const mutate = vi.fn();
  let store: ReturnType<typeof createOutboxStore>;
  const pass = () =>
    runReplayPass({
      store,
      ownerId: "u1",
      submit: (entry: OutboxEntry) =>
        replayOutboxEntry({ recipes: { update: { mutate } } }, entry, "test-outbox"),
    });

  beforeEach(async () => {
    mutate.mockReset();
    store = createOutboxStore(createMemoryStorage().outbox);
    await store.enqueue({
      id: "save",
      ownerId: "u1",
      path: "recipes.update",
      input: { id: "recipe-1", version: 1, data: { name: "Mine" } },
      entityId: null,
      operationId: "op-1",
      headers: {},
    });
  });

  it("retries a save the server failed with a 5xx, then removes it once stored", async () => {
    mutate.mockRejectedValueOnce({ data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 } });

    await pass();
    expect(await store.loadAll()).toEqual([
      expect.objectContaining({ status: "pending", attempts: 1 }),
    ]);

    mutate.mockResolvedValueOnce({ stale: false, version: 2 });
    await pass();
    expect(await store.loadAll()).toEqual([]);
  });

  it("parks a save the server refused", async () => {
    mutate.mockRejectedValueOnce({ data: { code: "FORBIDDEN", httpStatus: 403 } });

    await pass();
    expect(await store.loadAll()).toEqual([expect.objectContaining({ status: "parked" })]);
  });
});
