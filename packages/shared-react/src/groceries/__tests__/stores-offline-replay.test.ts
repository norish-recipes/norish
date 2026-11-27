/**
 * Store writes made offline, replayed in order against a server with the repository's version
 * rules: an edit at the Store's version stores and bumps it (a renamed Aisle bumps too), a reorder
 * renumbers without bumping, and a write at another version changes nothing and answers stale.
 * Each write is Queued by the real Outbox link, so it is stored as the app stores it.
 */
import { act, renderHook } from "@testing-library/react";
import { observable } from "@trpc/server/observable";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AisleInput, StoreDto } from "@norish/shared/contracts";
import { useStoresMutations } from "@norish/shared-react/groceries";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import type { OutboxEntry } from "../../offline/outbox-types";
import { createOutboxLink, MUTATION_SEND_TIMEOUT_MS } from "../../offline/outbox-link";
import { createOutboxStore } from "../../offline/outbox-store";
import { runReplayPass } from "../../offline/replay";
import { replayOutboxEntry } from "../../offline/replay-client";
import { createMemoryStorage } from "../../offline/testing/memory-storage";

const sends = vi.hoisted(() => ({
  create: vi.fn(),
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
      create: procedure(sends.create),
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
  const sent: string[] = [];
  const groceryVersions = new Map([["g1", 1]]);
  const client = {
    groceries: {
      update: {
        mutate: async (input: { groceryId: string; version: number }): Promise<Answer> => {
          sent.push("groceries.update");
          const refused = groceryVersions.get(input.groceryId) !== input.version;

          if (!refused) groceryVersions.set(input.groceryId, input.version + 1);

          return { success: true, stale: refused };
        },
      },
    },
    stores: {
      create: {
        mutate: async (input: { id: string; name: string }): Promise<string> => {
          sent.push("stores.create");
          if ([...db.values()].some((row) => row.name === input.name)) {
            throw new Error("A store with this name already exists");
          }
          db.set(input.id, {
            ...structuredClone(rows[1]!),
            id: input.id,
            name: input.name,
            sortOrder: db.size,
            version: 1,
          });

          return input.id;
        },
      },
      chooseProduct: {
        mutate: async (input: { storeId: string }): Promise<{ success: true }> => {
          sent.push("stores.chooseProduct");
          if (!db.has(input.storeId)) throw new Error("Store not found");

          return { success: true };
        },
      },
      update: {
        mutate: async (input: {
          id: string;
          version: number;
          name?: string;
          aisles?: AisleInput[];
        }): Promise<Answer> => {
          sent.push("stores.update");
          if (stale(input.id, input.version)) return { success: true, stale: true };
          const row = db.get(input.id)!;

          if (input.name !== undefined) row.name = input.name;
          if (input.aisles) {
            row.aisles = input.aisles.map((next, index) => {
              const was = row.aisles.find((a) => a.id === next.id);
              const current = !was || next.version === undefined || next.version === was.version;

              if (!was)
                return {
                  id: next.id,
                  storeId: row.id,
                  name: next.name,
                  sortOrder: index,
                  version: 1,
                };
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
        mutate: async (input: {
          stores: Array<{ id: string; version: number }>;
        }): Promise<Answer> => {
          sent.push("stores.reorder");
          const current = input.stores.filter(({ id, version }) => !stale(id, version));

          input.stores.forEach(({ id, version }, index) => {
            if (!stale(id, version)) db.get(id)!.sortOrder = index;
          });

          return { success: true, stale: current.length < input.stores.length };
        },
      },
      delete: {
        mutate: async (input: { storeId: string; version: number }): Promise<Answer> => {
          sent.push("stores.delete");
          if (!db.has(input.storeId)) return { success: true, stale: false };
          if (stale(input.storeId, input.version)) return { success: true, stale: true };
          db.delete(input.storeId);

          return { success: true, stale: false };
        },
      },
    },
  };

  return { db, client, sent };
}

describe("store writes made offline, replayed", () => {
  const store = createOutboxStore(createMemoryStorage().outbox);
  const link = createOutboxLink({
    store,
    owner: () => OWNER,
    household: () => "h1",
    replayHeaderValue: "test-outbox",
    wholeEdits: new Set(["recipes.update"]),
  })({} as never);

  // Unreachable: the write fails as the transport fails it, and the Outbox link Queues it.
  const queue = (path: string, input: unknown) =>
    new Promise<never>((_, reject) =>
      link({
        op: { id: 1, type: "mutation", path, input, context: {} },
        next: () => observable((observer) => observer.error(new TypeError("Failed to fetch"))),
      } as never).subscribe({ error: reject })
    );

  beforeEach(async () => {
    for (const entry of await store.loadAll()) await store.remove(entry.seq);
    for (const [path, send] of Object.entries(sends)) {
      send.mockReset();
      send.mockImplementation((input: unknown) => queue(`stores.${path}`, input));
    }
  });

  async function offline(steps: Array<(m: M, stores: StoreDto[]) => unknown>) {
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

      await act(async () => {
        await step(result.current, queryClient.getQueryData<StoreDto[]>(["stores", "list"])!);
      });
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
      householdId: "h1",
      submit: (entry: OutboxEntry) => replayOutboxEntry(client, entry, "test-outbox"),
    });

  const swap = (m: M) => m.reorderStores(["dirk", "lidl"]);
  const back = (m: M) => m.reorderStores(["lidl", "dirk"]);
  const rename = (name: string) => (m: M) => m.updateStore({ id: "lidl", name });
  const remove = (m: M) => m.deleteStore("lidl", false);
  // The editor sends every aisle at the version it holds, in its new order.
  const editAisles =
    (change: (aisles: StoreDto["aisles"]) => Array<{ id: string; name: string }>) =>
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
  const addFruit = editAisles((aisles) => [...aisles, { id: "fruit", name: "Fruit" }]);
  const create = (name: string) => (m: M) => m.createStore({ name });
  // The newest Store of that name: a create the server refuses may share one.
  const idOf = (stores: StoreDto[], name: string) => stores.findLast((s) => s.name === name)!.id;
  // Writes other screens make about the Store, Queued the way theirs are.
  const groceryToLidl = () =>
    queue("groceries.update", { groceryId: "g1", version: 1, raw: "melk", storeId: "lidl" }).catch(
      () => undefined
    );
  const chooseForLidl = () =>
    queue("stores.chooseProduct", {
      storeId: "lidl",
      name: "melk",
      choice: { kind: "typed", price: 0.89, currency: "EUR" },
    }).catch(() => undefined);

  it.each([
    ["reorder, then reorder", [swap, back], { order: ["lidl", "dirk"], name: "Lidl" }],
    [
      "reorder, then edit",
      [swap, rename("Lidl Centrum")],
      { order: ["dirk", "lidl"], name: "Lidl Centrum" },
    ],
    [
      "edit, then edit",
      [rename("Lidl 1"), rename("Lidl 2")],
      { order: ["lidl", "dirk"], name: "Lidl 2" },
    ],
  ])("%s: every write is stored", async (_, steps, expected) => {
    await offline(steps);
    const server = serverOf(held());

    const pass = await replay(server.client);

    expect(pass).toMatchObject({ removed: steps.length, parked: 0, conflicted: [] });
    expect(
      [...server.db.values()].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.id)
    ).toEqual(expected.order);
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

  it("an Aisle add: stored after the Aisles there were", async () => {
    await offline([addFruit]);
    const server = serverOf(held());

    const pass = await replay(server.client);

    expect(pass).toMatchObject({ removed: 1, parked: 0, conflicted: [] });
    expect(server.db.get("lidl")?.aisles.map((a) => [a.id, a.sortOrder, a.version])).toEqual([
      ["dairy", 0, 1],
      ["bread", 1, 1],
      ["fruit", 2, 1],
    ]);
  });

  it("a Store created offline, then edited, then reordered: every write is stored", async () => {
    await offline([
      create("Jumbo"),
      (m, stores) => m.updateStore({ id: idOf(stores, "Jumbo"), name: "Jumbo XL" }),
      (m, stores) => m.reorderStores([idOf(stores, "Jumbo XL"), "lidl", "dirk"]),
    ]);
    const server = serverOf(held());

    const pass = await replay(server.client);

    expect(pass).toMatchObject({ removed: 3, parked: 0, conflicted: [] });
    expect(
      [...server.db.values()].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.name)
    ).toEqual(["Jumbo XL", "Lidl", "Dirk"]);
  });

  it("parks the writes about a Store whose create was refused, as one story", async () => {
    await offline([
      create("Dirk"),
      (m, stores) => m.updateStore({ id: idOf(stores, "Dirk"), name: "Dirk Noord" }),
    ]);
    const server = serverOf(held());

    const pass = await replay(server.client);

    expect(server.sent).toEqual(["stores.create"]);
    expect(pass).toMatchObject({ removed: 0, parked: 2 });
    expect((await store.loadAll()).map((e) => [e.path, e.parkedReason])).toEqual([
      ["stores.create", "deterministic"],
      ["stores.update", "dependency"],
    ]);
  });

  it("sends every later write about a Store whose edit was refused, each decided on its own", async () => {
    await offline([rename("Lidl Centrum"), swap, groceryToLidl, chooseForLidl, remove]);
    const server = serverOf(held());

    server.db.get("lidl")!.name = "Lidl Noord";
    server.db.get("lidl")!.version = 2;
    const pass = await replay(server.client);

    expect(server.sent).toEqual([
      "stores.update",
      "stores.reorder",
      "groceries.update",
      "stores.chooseProduct",
      "stores.delete",
    ]);
    // The rename lost to the other member; the rest stood on the Store's version they held.
    expect(pass).toMatchObject({ removed: 4, parked: 1 });
    expect((await store.loadAll()).map((e) => [e.path, e.status])).toEqual([
      ["stores.update", "conflicted"],
    ]);
    expect(server.db.has("lidl")).toBe(false);
    expect(server.db.get("dirk")?.sortOrder).toBe(0);
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

  it("a live save that never answers is captured after the timeout, and the reorder behind it goes out", async () => {
    const timed = createOutboxLink({
      store,
      owner: () => OWNER,
      household: () => "h1",
      replayHeaderValue: "test-outbox",
      timedWrites: new Set(["stores.update", "stores.reorder"]),
    })({} as never);
    const reached: string[] = [];
    const send = (path: string, answer: boolean) => (input: unknown) =>
      new Promise((resolve, reject) =>
        timed({
          op: { id: 1, type: "mutation", path, input, context: {} },
          next: () =>
            observable((observer) => {
              reached.push(path);
              if (answer) observer.next({ result: { data: { success: true, stale: false } } });
              if (answer) observer.complete();
            }),
        } as never).subscribe({ next: ({ result }: never) => resolve(result), error: reject })
      );

    sends.update.mockImplementation(send("stores.update", false));
    sends.reorder.mockImplementation(send("stores.reorder", true));
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(["stores", "list"], held());
    const { result } = renderHook(() => useStoresMutations(), {
      wrapper: createTestWrapper(queryClient, fakePlatformAdapter()),
    });

    vi.useFakeTimers();
    try {
      act(() => result.current.updateStore({ id: "lidl", name: "Lidl Centrum" }));
      act(() => result.current.reorderStores(["dirk", "lidl"]));
      await act(() => vi.advanceTimersByTimeAsync(MUTATION_SEND_TIMEOUT_MS - 1));
      expect(reached).toEqual(["stores.update"]);
      await act(() => vi.advanceTimersByTimeAsync(2));
    } finally {
      vi.useRealTimers();
    }
    await act(async () => {
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    });

    expect(reached).toEqual(["stores.update", "stores.reorder"]);
    expect((await store.loadAll()).map((entry) => entry.path)).toEqual(["stores.update"]);
  });
});
