/**
 * Store writes made offline, replayed in order against a server with the repository's version
 * rules: an edit at the Store's version stores and bumps it (a renamed Aisle bumps too), a reorder
 * renumbers without bumping, and a write at another version changes nothing and answers stale.
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AisleInput, StoreDto } from "@norish/shared/contracts";
import { useStoresMutations } from "@norish/shared-react/groceries";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import type { OutboxEntry } from "../../offline/outbox-types";
import { createOutboxStore } from "../../offline/outbox-store";
import { runReplayPass } from "../../offline/replay";
import { replayOutboxEntry } from "../../offline/replay-client";
import { createMemoryStorage } from "../../offline/testing/memory-storage";

const sends = vi.hoisted(() => ({
  update: vi.fn(),
  delete: vi.fn(),
  reorder: vi.fn(),
}));

const procedure = (mutationFn: (input: unknown) => unknown) => ({
  mutationOptions: (options?: object) => ({ ...options, mutationFn }),
});

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    groceries: { list: { queryKey: () => ["groceries", "list"] } },
    stores: {
      list: { queryKey: () => ["stores", "list"] },
      create: procedure(vi.fn()),
      update: procedure(sends.update),
      delete: procedure(sends.delete),
      reorder: procedure(sends.reorder),
      checkSearchAddress: procedure(vi.fn()),
    },
  }),
}));

type M = ReturnType<typeof useStoresMutations>;
type Answer = { success: true; stale: boolean };

const OWNER = "u1";

const aisle = (id: string, name: string, sortOrder: number) => ({
  id,
  storeId: "lidl",
  name,
  sortOrder,
  version: 1,
});

const held = (): StoreDto[] => [
  {
    id: "lidl",
    userId: OWNER,
    name: "Lidl",
    color: "primary",
    website: null,
    searchAddress: null,
    sortOrder: 0,
    version: 1,
    aisles: [aisle("dairy", "Dairy", 0), aisle("bread", "Bread", 1)],
  },
  {
    id: "dirk",
    userId: OWNER,
    name: "Dirk",
    color: "primary",
    website: null,
    searchAddress: null,
    sortOrder: 1,
    version: 1,
    aisles: [],
  },
];

function serverOf(rows: StoreDto[]) {
  const db = new Map(rows.map((row) => [row.id, structuredClone(row)]));
  const stale = (id: string, version: number) => db.get(id)?.version !== version;
  const client = {
    stores: {
      update: {
        mutate: async (input: {
          id: string;
          version: number;
          name?: string;
          aisles?: AisleInput[];
        }): Promise<Answer> => {
          if (stale(input.id, input.version)) return { success: true, stale: true };
          const row = db.get(input.id)!;

          if (input.name !== undefined) row.name = input.name;
          if (input.aisles) {
            row.aisles = input.aisles.map((next, index) => {
              const was = row.aisles.find((a) => a.id === next.id);
              const current = !was || next.version === undefined || next.version === was.version;

              if (!was) return { id: next.id, storeId: row.id, name: next.name, sortOrder: index, version: 1 };
              if (!current) return was;

              return {
                ...was,
                name: next.name,
                sortOrder: index,
                version: was.version + (was.name === next.name ? 0 : 1),
              };
            });
          }
          row.version += 1;

          return { success: true, stale: false };
        },
      },
      reorder: {
        mutate: async (input: { stores: Array<{ id: string; version: number }> }): Promise<Answer> => {
          const current = input.stores.filter(({ id, version }) => !stale(id, version));

          input.stores.forEach(({ id, version }, index) => {
            if (!stale(id, version)) db.get(id)!.sortOrder = index;
          });

          return { success: true, stale: current.length < input.stores.length };
        },
      },
      delete: {
        mutate: async (input: { storeId: string; version: number }): Promise<Answer> => {
          if (!db.has(input.storeId)) return { success: true, stale: false };
          if (stale(input.storeId, input.version)) return { success: true, stale: true };
          db.delete(input.storeId);

          return { success: true, stale: false };
        },
      },
    },
  };

  return { db, client };
}

describe("store writes made offline, replayed", () => {
  const store = createOutboxStore(createMemoryStorage().outbox);
  let queued = 0;

  beforeEach(async () => {
    for (const entry of await store.loadAll()) await store.remove(entry.seq);
    for (const [path, send] of Object.entries(sends)) {
      send.mockReset();
      // Unreachable: the write is Queued, as the Outbox link admits it.
      send.mockImplementation(async (input: unknown) => {
        queued += 1;
        await store.enqueue({
          id: `entry-${queued}`,
          ownerId: OWNER,
          path: `stores.${path}`,
          input: structuredClone(input),
          entityId: null,
          operationId: null,
          headers: {},
        });
        throw new TypeError("Failed to fetch");
      });
    }
  });

  async function offline(steps: Array<(m: M, stores: StoreDto[]) => void>) {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(["stores", "list"], held());
    queryClient.setQueryData(["groceries", "list"], {
      groceries: [],
      recurringGroceries: [],
      recipeMap: {},
    });

    for (const step of steps) {
      const { result, unmount } = renderHook(() => useStoresMutations(), {
        wrapper: createTestWrapper(queryClient, fakePlatformAdapter()),
      });

      act(() => step(result.current, queryClient.getQueryData<StoreDto[]>(["stores", "list"])!));
      await act(async () => {
        await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
      });
      unmount();
    }
  }

  const replay = (client: ReturnType<typeof serverOf>["client"]) =>
    runReplayPass({
      store,
      ownerId: OWNER,
      submit: (entry: OutboxEntry) => replayOutboxEntry(client, entry, "test-outbox"),
    });

  const swap = (m: M) => m.reorderStores(["dirk", "lidl"]);
  const back = (m: M) => m.reorderStores(["lidl", "dirk"]);
  const rename = (name: string) => (m: M) => m.updateStore({ id: "lidl", name });
  const remove = (m: M) => m.deleteStore("lidl", false);
  // The editor sends every aisle at the version it holds, in its new order.
  const editAisles = (change: (aisles: StoreDto["aisles"]) => Array<{ id: string; name: string }>) =>
    (m: M, stores: StoreDto[]) => {
      const lidl = stores.find((s) => s.id === "lidl")!;
      const versions = new Map(lidl.aisles.map((a) => [a.id, a.version]));

      m.updateStore({
        id: "lidl",
        aisles: change([...lidl.aisles].sort((a, b) => a.sortOrder - b.sortOrder)).map((a) => ({
          ...a,
          version: versions.get(a.id),
        })),
      });
    };
  const moveAisles = editAisles((aisles) => [...aisles].reverse());
  const renameDairy = editAisles((aisles) =>
    aisles.map((a) => (a.id === "dairy" ? { ...a, name: "Milk" } : a))
  );

  it.each([
    ["reorder, then reorder", [swap, back], { order: ["lidl", "dirk"], name: "Lidl" }],
    ["reorder, then edit", [swap, rename("Lidl Centrum")], { order: ["dirk", "lidl"], name: "Lidl Centrum" }],
    ["edit, then edit", [rename("Lidl 1"), rename("Lidl 2")], { order: ["lidl", "dirk"], name: "Lidl 2" }],
  ])("%s: every write is stored", async (_, steps, expected) => {
    await offline(steps);
    const server = serverOf(held());

    const pass = await replay(server.client);

    expect(pass).toMatchObject({ removed: steps.length, parked: 0, conflicted: [] });
    expect([...server.db.values()].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.id)).toEqual(
      expected.order
    );
    expect(server.db.get("lidl")?.name).toBe(expected.name);
  });

  it.each([
    ["reorder, then delete", [swap, remove]],
    ["edit, then delete", [rename("Lidl Centrum"), remove]],
  ])("%s: the Store is gone", async (_, steps) => {
    await offline(steps);
    const server = serverOf(held());

    const pass = await replay(server.client);

    expect(pass).toMatchObject({ removed: 2, parked: 0, conflicted: [] });
    expect(server.db.has("lidl")).toBe(false);
  });

  it("an Aisle reorder, then an Aisle rename, in two saves: both are stored", async () => {
    await offline([moveAisles, renameDairy]);
    const server = serverOf(held());

    const pass = await replay(server.client);

    expect(pass).toMatchObject({ removed: 2, parked: 0, conflicted: [] });
    expect(server.db.get("lidl")?.aisles.map((a) => [a.name, a.sortOrder])).toEqual([
      ["Bread", 0],
      ["Milk", 1],
    ]);
  });

  it("parks an edit as Conflicted, once, when another member changed the Store meanwhile", async () => {
    await offline([rename("Lidl Centrum")]);
    const server = serverOf(held());

    server.db.get("lidl")!.name = "Lidl Noord";
    server.db.get("lidl")!.version = 2;
    const pass = await replay(server.client);

    expect(pass.conflicted.map((entry) => entry.path)).toEqual(["stores.update"]);
    expect(server.db.get("lidl")?.name).toBe("Lidl Noord");
    expect((await store.forOwner(OWNER, "conflicted")).map((entry) => entry.path)).toEqual([
      "stores.update",
    ]);
    // A second pass finds nothing new to tell.
    await expect(replay(server.client)).resolves.toMatchObject({ conflicted: [] });
  });
});
