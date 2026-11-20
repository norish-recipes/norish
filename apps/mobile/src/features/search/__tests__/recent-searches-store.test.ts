import { beforeEach, describe, expect, it, vi } from "vitest";

const device = vi.hoisted(() => {
  const state = {
    /** The owner whose data the cache manager has open. */
    owner: null as string | null,
    data: new Map<string, unknown>(),
    listeners: new Set<() => void>(),
    /** Reads held back until the test lets them answer, by the owner each was made for. */
    held: null as Array<{ owner: string; answer: () => void }> | null,
  };
  const key = (owner: string, name: string) => `${owner}:${name}`;

  return {
    state,
    cache: {
      ownerData: {
        owner: () => state.owner,
        subscribe: (listener: () => void) => {
          state.listeners.add(listener);

          return () => state.listeners.delete(listener);
        },
        read: (owner: string, name: string) =>
          new Promise<unknown>((resolve) => {
            // The manager reads only for the open owner, as of when the read is made.
            const value = owner === state.owner ? state.data.get(key(owner, name)) : undefined;
            const answer = () => resolve(value);

            if (state.held) state.held.push({ owner, answer });
            else answer();
          }),
        write: async (owner: string, name: string, value: unknown) => {
          if (owner === state.owner) state.data.set(key(owner, name), value);
        },
      },
    },
  };
});

vi.mock("@/lib/offline/engine", () => ({ offlineEngine: { cache: device.cache } }));

const { addRecentSearch, clearRecentSearches, getRecentSearches } =
  await import("../utils/recent-searches-store");

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** What the cache manager does: open an owner's data, or close it, and tell the readers. */
function openOwner(owner: string | null) {
  device.state.owner = owner;
  device.state.listeners.forEach((listener) => listener());
}

async function applyOwner(owner: string | null) {
  openOwner(owner);
  await settle();
}

/** Lets the held reads answer, in the order they were made. */
async function answerReads() {
  const held = device.state.held ?? [];

  device.state.held = null;
  held.forEach(({ answer }) => answer());
  await settle();
}

/** Lets the held read made for `owner` answer. */
async function answerReadFor(owner: string) {
  device.state.held?.find((read) => read.owner === owner)?.answer();
  await settle();
}

describe("Recent Searches on the device", () => {
  beforeEach(async () => {
    device.state.held = null;
    device.state.data.clear();
    await applyOwner(null);
  });

  it("keeps a list per account and shows none without one", async () => {
    addRecentSearch("tacos");

    expect(getRecentSearches()).toEqual([]);

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

  it("forgets the list on a manual wipe, and the next search keeps only itself", async () => {
    await applyOwner("u1");
    addRecentSearch("pizza");
    await settle();

    // A manual wipe closes the same owner's data, clears it, and opens it again.
    openOwner(null);
    device.state.data.clear();
    await applyOwner("u1");

    expect(getRecentSearches()).toEqual([]);

    addRecentSearch("soup");
    await settle();

    expect(device.state.data.get("u1:recent-searches")).toEqual(["soup"]);
  });

  it("empties the list the moment a switch starts and writes nothing until the next owner", async () => {
    device.state.data.set("u2:recent-searches", ["theirs"]);
    await applyOwner("u1");
    addRecentSearch("pizza");
    await settle();

    openOwner(null);

    expect(getRecentSearches()).toEqual([]);

    // A confirm during the switch reaches nobody's stored list.
    addRecentSearch("mid-switch");

    expect(getRecentSearches()).toEqual([]);

    device.state.data.delete("u1:recent-searches");
    await applyOwner("u2");

    expect(getRecentSearches()).toEqual(["theirs"]);
    expect(device.state.data.has("u1:recent-searches")).toBe(false);
  });

  it("drops a late read for the previous owner once the next one applied", async () => {
    device.state.data.set("u1:recent-searches", ["mine"]);
    device.state.data.set("u2:recent-searches", ["theirs"]);
    device.state.held = [];
    openOwner("u1");
    openOwner(null);
    openOwner("u2");
    await answerReadFor("u2");
    addRecentSearch("soup");
    await settle();
    await answerReadFor("u1");

    expect(getRecentSearches()).toEqual(["soup", "theirs"]);
    expect(device.state.data.get("u2:recent-searches")).toEqual(["soup", "theirs"]);
    expect(device.state.data.get("u1:recent-searches")).toEqual(["mine"]);
  });

  it("merges a search confirmed while the stored list loads", async () => {
    device.state.data.set("u1:recent-searches", ["pizza", "tacos"]);
    device.state.held = [];
    openOwner("u1");
    addRecentSearch("falafel");
    addRecentSearch("Pizza");

    expect(device.state.data.get("u1:recent-searches")).toEqual(["pizza", "tacos"]);

    await answerReads();

    expect(getRecentSearches()).toEqual(["Pizza", "falafel", "tacos"]);
    expect(device.state.data.get("u1:recent-searches")).toEqual(getRecentSearches());
  });

  it("applies a clear made while the stored list loads", async () => {
    device.state.data.set("u1:recent-searches", ["pizza"]);
    device.state.held = [];
    openOwner("u1");
    clearRecentSearches();
    addRecentSearch("soup");
    await answerReads();

    expect(getRecentSearches()).toEqual(["soup"]);
    expect(device.state.data.get("u1:recent-searches")).toEqual(["soup"]);
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
