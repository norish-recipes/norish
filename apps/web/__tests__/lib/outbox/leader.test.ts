import { OUTBOX_LEADER_LOCK, runIfLeader, runWithOutboxLock } from "@/lib/outbox/leader";
import { afterEach, describe, expect, it, vi } from "vitest";

type RequestFn = (
  name: string,
  options: { mode: string; ifAvailable?: boolean },
  callback: (lock: unknown) => Promise<unknown>
) => Promise<unknown>;

function stubLocks(request: RequestFn) {
  Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
}

describe("outbox leader without Web Locks", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "locks");
  });

  it("runs the task directly (idempotency keeps a doubled run safe)", async () => {
    expect(await runWithOutboxLock(async () => "drained")).toBe("drained");
    expect(await runIfLeader(async () => "warmed")).toBe("warmed");
  });
});

describe("outbox leader with Web Locks", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "locks");
  });

  it("runWithOutboxLock takes a blocking exclusive lock", async () => {
    const request = vi.fn<RequestFn>((_name, _opts, cb) => cb({}));

    stubLocks(request);

    expect(await runWithOutboxLock(async () => "ok")).toBe("ok");
    expect(request).toHaveBeenCalledWith(
      OUTBOX_LEADER_LOCK,
      { mode: "exclusive" },
      expect.any(Function)
    );
  });

  it("runIfLeader warms when it wins the lock", async () => {
    const request = vi.fn<RequestFn>((_name, _opts, cb) => cb({}));

    stubLocks(request);

    expect(await runIfLeader(async () => "warmed")).toBe("warmed");
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

    stubLocks(request);

    expect(await runIfLeader(task)).toBeUndefined();
    expect(task).not.toHaveBeenCalled();
  });
});
