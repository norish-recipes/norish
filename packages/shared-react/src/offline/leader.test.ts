import { describe, expect, it, vi } from "vitest";

import type { LockManagerLike } from "./leader";
import { OUTBOX_LEADER_LOCK, runIfLeader, runWithOutboxLock } from "./leader";

type RequestFn = (
  name: string,
  options: { mode: string; ifAvailable?: boolean },
  callback: (lock: unknown) => Promise<unknown>
) => Promise<unknown>;

function locksWith(request: RequestFn): LockManagerLike {
  return { request } as LockManagerLike;
}

describe("outbox leader without a lock manager", () => {
  it("runs the task directly (idempotency keeps a doubled run safe)", async () => {
    expect(await runWithOutboxLock(async () => "drained", null)).toBe("drained");
    expect(await runIfLeader(async () => "warmed", null)).toBe("warmed");
  });
});

describe("outbox leader with a lock manager", () => {
  it("runWithOutboxLock takes a blocking exclusive lock", async () => {
    const request = vi.fn<RequestFn>((_name, _opts, cb) => cb({}));

    expect(await runWithOutboxLock(async () => "ok", locksWith(request))).toBe("ok");
    expect(request).toHaveBeenCalledWith(
      OUTBOX_LEADER_LOCK,
      { mode: "exclusive" },
      expect.any(Function)
    );
  });

  it("runIfLeader warms when it wins the lock", async () => {
    const request = vi.fn<RequestFn>((_name, _opts, cb) => cb({}));

    expect(await runIfLeader(async () => "warmed", locksWith(request))).toBe("warmed");
    expect(request).toHaveBeenCalledWith(
      OUTBOX_LEADER_LOCK,
      { mode: "exclusive", ifAvailable: true },
      expect.any(Function)
    );
  });

  it("runIfLeader skips (undefined) when another tab holds the lock", async () => {
    const task = vi.fn(async () => "warmed");
    // ifAvailable → the lock is null when it can't be granted immediately.
    const request = vi.fn<RequestFn>((_name, _opts, cb) => cb(null));

    expect(await runIfLeader(task, locksWith(request))).toBeUndefined();
    expect(task).not.toHaveBeenCalled();
  });
});
