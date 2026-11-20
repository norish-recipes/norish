import { beforeEach, describe, expect, it, vi } from "vitest";

const device = vi.hoisted(() => {
  const state = {
    owner: null as string | null,
    data: new Map<string, unknown>(),
    listeners: new Set<() => void>(),
  };
  const key = (name: string) => `${state.owner}:${name}`;

  return {
    state,
    cache: {
      owner: () => state.owner,
      subscribe: (listener: () => void) => {
        state.listeners.add(listener);

        return () => state.listeners.delete(listener);
      },
      ownerData: {
        read: async (name: string) => (state.owner ? state.data.get(key(name)) : undefined),
        write: async (name: string, value: unknown) => {
          if (state.owner) state.data.set(key(name), value);
        },
      },
    },
  };
});

vi.mock("@/lib/offline/engine", () => ({ offlineEngine: { cache: device.cache } }));

const { addRecentSearch, clearRecentSearches, getRecentSearches } =
  await import("../utils/recent-searches-store");

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** What the cache manager does: apply an owner and tell the listeners. */
async function applyOwner(owner: string | null) {
  device.state.owner = owner;
  device.state.listeners.forEach((listener) => listener());
  await settle();
}

describe("Recent Searches on the device", () => {
  beforeEach(async () => {
    device.state.data.clear();
    await applyOwner(null);
  });

  it("keeps a list per account and shows none without one", async () => {
    addRecentSearch("tacos");

    expect(getRecentSearches()).toEqual(["tacos"]);

    await applyOwner("u1");
    addRecentSearch("pizza");
    addRecentSearch("falafel");
    await settle();

    expect(getRecentSearches()).toEqual(["falafel", "pizza"]);
    expect(device.state.data.get("u1:recent-searches")).toEqual(["falafel", "pizza"]);

    await applyOwner("u2");

    expect(getRecentSearches()).toEqual([]);

    await applyOwner("u1");

    expect(getRecentSearches()).toEqual(["falafel", "pizza"]);
  });

  it("is empty after the sign-out wipe", async () => {
    await applyOwner("u1");
    addRecentSearch("pizza");
    await settle();

    // The wipe clears the owner's stored data, then the manager applies no owner.
    device.state.data.clear();
    await applyOwner(null);

    expect(getRecentSearches()).toEqual([]);

    await applyOwner("u1");

    expect(getRecentSearches()).toEqual([]);
  });

  it("clears the list and the stored copy", async () => {
    await applyOwner("u1");
    addRecentSearch("pizza");
    clearRecentSearches();
    await settle();

    expect(getRecentSearches()).toEqual([]);
    expect(device.state.data.get("u1:recent-searches")).toEqual([]);
  });
});
