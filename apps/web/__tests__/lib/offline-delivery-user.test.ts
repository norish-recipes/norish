import { beforeEach, describe, expect, it, vi } from "vitest";

import { getWebOutboxUserId } from "../../lib/offline-delivery-user";

const getSession = vi.hoisted(() => vi.fn());

vi.mock("@norish/shared/lib/auth/client", () => ({ getSession }));

describe("offline delivery user scope", () => {
  beforeEach(() => {
    getSession.mockReset();
    window.localStorage.clear();
  });

  it("uses the last confirmed user when session refresh is unreachable", async () => {
    getSession.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });
    await expect(getWebOutboxUserId()).resolves.toBe("user-1");

    getSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(getWebOutboxUserId()).resolves.toBe("user-1");
  });

  it("clears the fallback after a confirmed sign-out", async () => {
    window.localStorage.setItem("norish-web-outbox-user-id", "user-1");
    getSession.mockResolvedValueOnce({ data: null, error: null });

    await expect(getWebOutboxUserId()).resolves.toBeNull();
    expect(window.localStorage.getItem("norish-web-outbox-user-id")).toBeNull();
  });
});
