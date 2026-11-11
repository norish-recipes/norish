import { beforeEach, describe, expect, it, vi } from "vitest";

const order = vi.hoisted(() => [] as string[]);
const clearForSignOut = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc/trpc-provider", () => ({
  closeMobileTrpcConnections: async () => void order.push("closed"),
}));
vi.mock("@/lib/offline/engine", () => ({ offlineEngine: { clearForSignOut } }));
vi.mock("@/lib/auth/auth-client", () => ({
  resetAuthClientStorage: async () => void order.push("stored session reset"),
}));

const { clearSession } = await import("@/lib/auth/sign-out");

describe("clearSession", () => {
  const authClient = { signOut: vi.fn(async () => void order.push("auth server")) };

  beforeEach(() => {
    order.length = 0;
    authClient.signOut.mockClear();
    clearForSignOut.mockReset().mockImplementation(async () => void order.push("cleared"));
  });

  it("signs out of the auth server, keeping the Outbox unless discarded", async () => {
    await clearSession(authClient);

    expect(clearForSignOut).toHaveBeenCalledWith({ discardQueue: false });
    expect(order).toEqual(["closed", "cleared", "auth server", "stored session reset"]);
  });

  it("after the Account was deleted, clears the offline data and its Outbox without the auth server", async () => {
    await clearSession(authClient, { accountDeleted: true });

    expect(clearForSignOut).toHaveBeenCalledWith({ discardQueue: true });
    expect(order).toEqual(["closed", "cleared", "stored session reset"]);
  });

  it.each([{}, { accountDeleted: true }])(
    "still resets the stored session when clearing fails (%o)",
    async (options) => {
      clearForSignOut.mockRejectedValue(new Error("disk full"));

      await clearSession(authClient, options);

      expect(order.at(-1)).toBe("stored session reset");
    }
  );
});
