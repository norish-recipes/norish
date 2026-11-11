import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const betterAuthSignOut = vi.hoisted(() => vi.fn());
const clearForSignOut = vi.hoisted(() => vi.fn());

vi.mock("@norish/shared/lib/auth/client", () => ({ signOut: betterAuthSignOut }));
vi.mock("@/lib/offline/engine", () => ({ offlineEngine: { clearForSignOut } }));

const { signOut } = await import("@/lib/auth/sign-out");

describe("the web's sign-out", () => {
  const originalLocation = window.location;
  let order: string[] = [];

  beforeEach(() => {
    order = [];
    betterAuthSignOut.mockReset().mockResolvedValue({});
    clearForSignOut.mockReset().mockImplementation(async () => void order.push("cleared"));
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        set href(url: string) {
          order.push(url);
        },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("keeps the Outbox and loads sign-in once the auth server signed the reader out", async () => {
    await signOut();

    expect(betterAuthSignOut).toHaveBeenCalledOnce();
    expect(clearForSignOut).toHaveBeenCalledWith({ discardQueue: false });
    expect(order).toEqual(["cleared", "/login?logout=true"]);
  });

  it("leaves everything as it was when the auth server could not sign the reader out", async () => {
    betterAuthSignOut.mockRejectedValue(new Error("offline"));

    await signOut();

    expect(clearForSignOut).not.toHaveBeenCalled();
    expect(order).toEqual([]);
  });

  it("after the Account was deleted, clears the offline data and its Outbox without the auth server", async () => {
    await signOut({ accountDeleted: true });

    expect(betterAuthSignOut).not.toHaveBeenCalled();
    expect(clearForSignOut).toHaveBeenCalledWith({ discardQueue: true });
    expect(order).toEqual(["cleared", "/login"]);
  });
});
