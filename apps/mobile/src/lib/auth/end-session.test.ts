import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const order = vi.hoisted(() => [] as string[]);
const resetAuthClientStorage = vi.hoisted(() => vi.fn());
const closeMobileTrpcConnections = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc/trpc-provider", () => ({ closeMobileTrpcConnections }));
vi.mock("@/lib/auth/auth-client", () => ({ resetAuthClientStorage }));

const { endSession } = await import("@/lib/auth/end-session");

describe("endSession", () => {
  const authClient = {
    signOut: vi.fn(async (_options: { fetchOptions: { signal: AbortSignal } }) => {
      order.push("auth server");
    }),
  };

  beforeEach(() => {
    order.length = 0;
    authClient.signOut.mockReset().mockImplementation(async () => {
      order.push("auth server");
    });
    closeMobileTrpcConnections.mockReset().mockImplementation(async () => void order.push("closed"));
    resetAuthClientStorage
      .mockReset()
      .mockImplementation(async () => void order.push("stored session reset"));
  });

  afterEach(() => vi.useRealTimers());

  it("ends the session on the server, then closes the connections and resets the stored session", async () => {
    await endSession(authClient, "sign-out");

    expect(order).toEqual(["auth server", "closed", "stored session reset"]);
  });

  it("always succeeds: an unreachable server or a failed reset still ends it on this device", async () => {
    authClient.signOut.mockRejectedValue(new Error("offline"));
    resetAuthClientStorage.mockRejectedValue(new Error("keychain"));

    await expect(endSession(authClient, "sign-out")).resolves.toBeUndefined();
    expect(order).toEqual(["closed"]);
  });

  it("aborts a stalled server after 5 s, so it cannot answer late, and still ends it on this device", async () => {
    vi.useFakeTimers();
    authClient.signOut.mockReturnValue(new Promise(() => {}));

    const ending = endSession(authClient, "sign-out");

    await vi.advanceTimersByTimeAsync(5_000);
    await ending;

    expect(authClient.signOut.mock.calls[0]?.[0].fetchOptions.signal.aborted).toBe(true);
    expect(order).toEqual(["closed", "stored session reset"]);
  });

  it("on expiry leaves the server alone and still ends it on this device", async () => {
    await endSession(authClient, "expiry");

    expect(authClient.signOut).not.toHaveBeenCalled();
    expect(order).toEqual(["closed", "stored session reset"]);
  });

  it("does not wait for a socket that never finishes closing, mid-reconnect to a stalled server", async () => {
    closeMobileTrpcConnections.mockReturnValue(new Promise(() => {}));

    await endSession(authClient, "expiry");

    expect(order).toEqual(["stored session reset"]);
  });
});
