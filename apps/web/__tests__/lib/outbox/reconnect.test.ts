import { describe, expect, it, vi } from "vitest";

import { runReconnectSequence } from "@/lib/outbox/reconnect";

describe("runReconnectSequence", () => {
  it("drains, then refetches, then warms — strictly in that order", async () => {
    const calls: string[] = [];

    const drain = vi.fn(async () => {
      calls.push("drain");
    });
    const invalidate = vi.fn(async () => {
      calls.push("invalidate");
    });
    const warm = vi.fn(async () => {
      calls.push("warm");
    });

    await runReconnectSequence({ drain, invalidate, warm });

    // The whole point: never refetch before the Outbox has drained, or queued
    // changes would visibly vanish and reappear.
    expect(calls).toEqual(["drain", "invalidate", "warm"]);
  });

  it("waits for each step to settle before starting the next", async () => {
    const order: string[] = [];
    const drain = vi.fn(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            order.push("drain-done");
            resolve();
          }, 10)
        )
    );
    const invalidate = vi.fn(async () => {
      order.push("invalidate-start");
    });
    const warm = vi.fn(async () => {
      order.push("warm-start");
    });

    await runReconnectSequence({ drain, invalidate, warm });

    expect(order).toEqual(["drain-done", "invalidate-start", "warm-start"]);
  });
});
