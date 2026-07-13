import { describe, expect, it, vi } from "vitest";

import type { WebOutboxEntry } from "./outbox-types";
import { WEB_OUTBOX_SCHEMA_VERSION } from "./outbox-types";
import { replayWebOutboxEntry } from "./replay-client";

describe("web outbox replay client", () => {
  it("preserves the operation identity and bypasses recursive capture", async () => {
    const mutate = vi.fn().mockResolvedValue({ success: true });
    const client = { recipes: { update: { mutate } } };
    const entry = {
      schemaVersion: WEB_OUTBOX_SCHEMA_VERSION,
      id: "entry-1",
      backendOrigin: "https://norish.test",
      userId: "user-1",
      operationId: "operation-1",
      path: "recipes.update",
      payloadKind: "superjson",
      encryptedInput: { iv: new ArrayBuffer(0), ciphertext: new ArrayBuffer(0) },
      createdAt: 1,
      creationOrder: 1,
      attempts: 0,
      nextRetryAt: null,
      state: "pending",
      expiresAt: 2,
    } satisfies WebOutboxEntry;

    await expect(replayWebOutboxEntry(client, entry, { id: "recipe-1" })).resolves.toEqual({
      success: true,
    });
    expect(mutate).toHaveBeenCalledWith(
      { id: "recipe-1" },
      expect.objectContaining({
        context: expect.objectContaining({
          operationId: "operation-1",
          skipOutboxCapture: true,
          headers: { "x-replay-origin": "web-outbox" },
        }),
      })
    );
  });
});
