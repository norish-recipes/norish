import { describe, expect, it, vi } from "vitest";

import type { OutboxEntry } from "@/lib/outbox/outbox-types";
import {
  isOutboxReplayContext,
  OUTBOX_REPLAY_HEADER,
  OUTBOX_REPLAY_HEADER_VALUE,
  replayOutboxEntry,
} from "@/lib/outbox/replay-client";

function entry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    seq: 1,
    id: "e",
    ownerId: "u1",
    path: "groceries.create",
    input: { id: "g1" },
    entityId: "g1",
    operationId: "op-1",
    headers: { "x-operation-id": "op-1" },
    createdAt: "2026-07-21T00:00:00.000Z",
    attempts: 0,
    status: "pending",
    ...overrides,
  };
}

function clientWith(mutate: (input: unknown, opts: unknown) => Promise<unknown>) {
  return { groceries: { create: { mutate } } };
}

describe("replayOutboxEntry", () => {
  it("resends through the path with the preserved operationId and a replay marker", async () => {
    const mutate = vi.fn(async () => ({ success: true }));

    const outcome = await replayOutboxEntry(clientWith(mutate), entry());

    expect(outcome).toEqual({ kind: "success" });

    const [input, opts] = mutate.mock.calls[0];

    expect(input).toEqual({ id: "g1" });
    expect(opts).toMatchObject({
      context: {
        operationId: "op-1",
        skipOutboxCapture: true,
        headers: { [OUTBOX_REPLAY_HEADER]: OUTBOX_REPLAY_HEADER_VALUE },
      },
    });
  });

  it("maps a stale response to a conflict", async () => {
    const outcome = await replayOutboxEntry(
      clientWith(async () => ({ success: true, stale: true })),
      entry()
    );

    expect(outcome).toEqual({ kind: "conflict" });
  });

  it("classifies a thrown transport error", async () => {
    const unreachable = await replayOutboxEntry(
      clientWith(async () => {
        throw new TypeError("Failed to fetch");
      }),
      entry()
    );

    expect(unreachable).toEqual({ kind: "unreachable" });

    const unauthorized = await replayOutboxEntry(
      clientWith(async () => {
        throw { data: { code: "UNAUTHORIZED", httpStatus: 401 } };
      }),
      entry()
    );

    expect(unauthorized).toEqual({ kind: "unauthorized" });
  });

  it("treats an unknown procedure path as deterministic (it can never succeed)", async () => {
    const outcome = await replayOutboxEntry({}, entry({ path: "does.not.exist" }));

    expect(outcome).toEqual({ kind: "deterministic" });
  });
});

describe("isOutboxReplayContext", () => {
  it("recognises the replay marker and header", () => {
    expect(isOutboxReplayContext({ skipOutboxCapture: true })).toBe(true);
    expect(
      isOutboxReplayContext({ headers: { [OUTBOX_REPLAY_HEADER]: OUTBOX_REPLAY_HEADER_VALUE } })
    ).toBe(true);
  });

  it("is false for a normal (first-time) mutation context", () => {
    expect(isOutboxReplayContext(undefined)).toBe(false);
    expect(isOutboxReplayContext({ operationId: "op-1", headers: {} })).toBe(false);
  });
});
