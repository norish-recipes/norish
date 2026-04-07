import { describe, expect, it, vi } from "vitest";

import { createRefreshRequestHandler } from "../../src/lib/refresh/create-refresh-request-handler";

describe("createRefreshRequestHandler", () => {
  it("prevents overlapping refresh requests", async () => {
    let callCount = 0;
    let release = () => {};
    const task = vi.fn(() => {
      callCount += 1;

      if (callCount > 1) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        release = () => {
          resolve();
        };
      });
    });

    const refresh = createRefreshRequestHandler(task);

    const first = refresh();
    const second = refresh();

    expect(task).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);

    release();
    await first;

    await refresh();
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("resets in-flight guard after failures", async () => {
    const task = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);

    const refresh = createRefreshRequestHandler(task);

    await expect(refresh()).rejects.toThrow("boom");
    await expect(refresh()).resolves.toBeUndefined();
    expect(task).toHaveBeenCalledTimes(2);
  });
});
