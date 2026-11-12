import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const order = vi.hoisted(() => [] as string[]);
const resetAuthClientStorage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc/trpc-provider", () => ({
  closeMobileTrpcConnections: async () => void order.push("closed"),
}));
vi.mock("@/lib/auth/auth-client", () => ({ resetAuthClientStorage }));

const { endSession } = await import("@/lib/auth/end-session");

describe("endSession", () => {
  const authClient = { signOut: vi.fn(async () => void order.push("auth server")) };

  beforeEach(() => {
    order.length = 0;
    authClient.signOut.mockReset().mockImplementation(async () => void order.push("auth server"));
    resetAuthClientStorage
      .mockReset()
      .mockImplementation(async () => void order.push("stored session reset"));
  });

  afterEach(() => vi.useRealTimers());

  it("ends the session on the server, then closes the connections and resets the stored session", async () => {
    await endSession(authClient);

    expect(order).toEqual(["auth server", "closed", "stored session reset"]);
  });

  it("always succeeds: an unreachable server or a failed reset still ends it on this device", async () => {
    authClient.signOut.mockRejectedValue(new Error("offline"));
    resetAuthClientStorage.mockRejectedValue(new Error("keychain"));

    await expect(endSession(authClient)).resolves.toBeUndefined();
    expect(order).toEqual(["closed"]);
  });

  it("gives up on a stalled server after 5 s and still ends it on this device", async () => {
    vi.useFakeTimers();
    authClient.signOut.mockReturnValue(new Promise(() => {}));

    const ending = endSession(authClient);

    await vi.advanceTimersByTimeAsync(5_000);
    await ending;

    expect(order).toEqual(["closed", "stored session reset"]);
  });
});
