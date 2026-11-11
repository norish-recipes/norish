import { createIdbStorage } from "@/lib/offline/idb-storage";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OfflineEngine, OfflineStorage } from "@norish/shared-react/offline";

const betterAuthSignOut = vi.hoisted(() => vi.fn());
// The real engine over fake-indexeddb, so a test reads what a sign-out left behind.
const offline = vi.hoisted(() => ({}) as { engine: OfflineEngine; storage: OfflineStorage });

vi.mock("@norish/shared/lib/auth/client", () => ({ signOut: betterAuthSignOut }));
vi.mock("@/lib/offline/engine", () => ({
  get offlineEngine() {
    return offline.engine;
  },
}));

const { createWebOfflineEngine } =
  await vi.importActual<typeof import("@/lib/offline/engine")>("@/lib/offline/engine");
const { signOut } = await import("@/lib/auth/sign-out");

describe("the web's sign-out", () => {
  const originalLocation = window.location;
  let address: string | undefined;

  /** u1 signed in, with a read held and persisted and one change waiting in the Outbox. */
  async function signedInWithWork() {
    const { engine } = offline;

    await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    engine.queryClient.setQueryData([["groceries", "list"], { type: "query" }], ["milk"]);
    await engine.outbox.enqueue({
      id: "e",
      ownerId: "u1",
      path: "groceries.create",
      input: { id: "g1" },
      entityId: "g1",
      operationId: null,
      headers: {},
    });
    await vi.waitFor(async () => expect(await offline.storage.keyval.keys()).not.toEqual([]));
  }

  beforeEach(() => {
    window.localStorage.clear();
    offline.storage = createIdbStorage(new IDBFactory());
    offline.engine = createWebOfflineEngine(offline.storage);
    address = undefined;
    betterAuthSignOut.mockReset().mockResolvedValue({});
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        set href(url: string) {
          address = url;
        },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("keeps the Outbox and loads sign-in once the auth server signed the reader out", async () => {
    await signedInWithWork();

    await signOut();

    expect(await offline.engine.outbox.size("u1")).toBe(1);
    expect(await offline.storage.keyval.keys()).toEqual([]);
    expect(address).toBe("/login?logout=true");
  });

  it("leaves everything as it was when the auth server could not sign the reader out", async () => {
    await signedInWithWork();
    betterAuthSignOut.mockRejectedValue(new Error("offline"));

    await signOut();

    expect(await offline.engine.unsyncedChanges()).toBe(1);
    expect(offline.engine.cache.owner()).toBe("u1");
    expect(address).toBeUndefined();
  });

  it("after the Account was deleted, leaves nothing behind without the auth server", async () => {
    await signedInWithWork();

    await signOut({ accountDeleted: true });

    expect(betterAuthSignOut).not.toHaveBeenCalled();
    expect(await offline.engine.outbox.size("u1")).toBe(0);
    expect(await offline.storage.keyval.keys()).toEqual([]);
    expect(address).toBe("/login");
  });

  it.each([
    ["the auth server signed the reader out", {}],
    ["the Account was deleted", { accountDeleted: true }],
  ])("still leaves for sign-in when clearing fails after %s", async (_, options) => {
    vi.spyOn(offline.engine, "clearForSignOut").mockRejectedValue(new Error("quota"));

    await expect(signOut(options)).resolves.toBeUndefined();

    expect(address).toMatch(/^\/login/);
  });
});
