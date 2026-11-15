/**
 * Grocery writes made offline, replayed in order against a server with the repository's version
 * rules: a write at the row's version stores and bumps it, a create shifts its Store's open lines
 * without bumping them, and a write at another version changes nothing and answers `stale: true`.
 * The fake only models the shift; packages/db's groceries-create test guards the real one.
 */
import type { inferRouterOutputs } from "@trpc/server";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRouter } from "@norish/trpc/client";
import { useGroceriesMutations } from "@norish/shared-react/groceries";
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
import { createMockGroceriesData, createMockGrocery } from "./test-utils";

const sends = vi.hoisted(() => ({
  create: vi.fn(),
  toggle: vi.fn(),
  update: vi.fn(),
}));

const procedure = (mutationFn: (input: unknown) => unknown) => ({
  mutationOptions: (options?: object) => ({ ...options, mutationFn }),
});
const unused = procedure(vi.fn());

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    groceries: {
      list: { queryKey: () => ["groceries", "list"] },
      create: procedure(sends.create),
      toggle: procedure(sends.toggle),
      update: procedure(sends.update),
      delete: unused,
      createRecurring: unused,
      updateRecurring: unused,
      deleteRecurring: unused,
      detachRecurring: unused,
      checkRecurring: unused,
      markAllDone: unused,
      deleteDone: unused,
      assignToStore: unused,
      reorderInStore: unused,
    },
  }),
}));

vi.mock("../../config", () => ({
  useUnitsQuery: () => ({ units: { volumeUnits: [], weightUnits: [], defaultUnit: "piece" } }),
}));

vi.mock("@norish/shared/lib/helpers", () => ({
  parseIngredientWithDefaults: vi.fn((raw: string) => [
    { description: raw.trim(), quantity: 1, unitOfMeasure: null },
  ]),
}));

type Answers = inferRouterOutputs<AppRouter>["groceries"];
type Row = {
  name: string;
  version: number;
  isDone: boolean;
  storeId: string | null;
  sortOrder: number;
};
type M = ReturnType<typeof useGroceriesMutations>;

const OWNER = "u1";

function serverOf(rows: Record<string, Row>) {
  const db = new Map(Object.entries(rows).map(([id, row]) => [id, { ...row }]));
  const stale = (id: string, version: number) => db.get(id)?.version !== version;
  const write = (id: string, change: Partial<Row>) => {
    const row = db.get(id)!;

    Object.assign(row, change, { version: row.version + 1 });
  };
  const client = {
    groceries: {
      create: {
        mutate: async (input: Array<{ id: string; name: string; storeId: string | null }>) => {
          for (const { id, name, storeId } of input) {
            for (const row of db.values()) {
              if (!row.isDone && row.storeId === storeId) row.sortOrder += 1;
            }
            db.set(id, { name, version: 1, isDone: false, storeId, sortOrder: 0 });
          }

          return { ids: input.map(({ id }) => id) };
        },
      },
      toggle: {
        mutate: async (input: {
          groceries: Array<{ id: string; version: number }>;
          isDone: boolean;
        }): Promise<Answers["toggle"]> => {
          const current = input.groceries.filter(({ id, version }) => !stale(id, version));

          for (const { id } of current) write(id, { isDone: input.isDone });

          return { success: true, stale: current.length < input.groceries.length };
        },
      },
      update: {
        mutate: async (input: {
          groceryId: string;
          raw: string;
          version: number;
        }): Promise<Answers["update"]> => {
          if (stale(input.groceryId, input.version)) return { success: true, stale: true };
          write(input.groceryId, { name: input.raw });

          return { success: true, stale: false };
        },
      },
    },
  };

  return { db, client };
}

describe("grocery writes made offline, replayed", () => {
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
          path: `groceries.${path}`,
          input: structuredClone(input),
          entityId: null,
          operationId: null,
          headers: {},
        });
        throw new TypeError("Failed to fetch");
      });
    }
  });

  const rows = (): Record<string, Row> => ({
    milk: { name: "Milk", version: 1, isDone: false, storeId: null, sortOrder: 0 },
    eggs: { name: "Eggs", version: 1, isDone: false, storeId: null, sortOrder: 1 },
  });

  async function offline(steps: Array<(m: M) => void>) {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(
      ["groceries", "list"],
      createMockGroceriesData(
        Object.entries(rows()).map(([id, row]) => createMockGrocery({ id, ...row }))
      )
    );

    for (const step of steps) {
      const { result, unmount } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, fakePlatformAdapter()),
      });

      act(() => step(result.current));
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

  const edit = (m: M) => m.updateGrocery("milk", "Oat milk");
  const add = (m: M) => m.createGrocery("Bread");
  const tickOther = (m: M) => m.toggleGroceries(["eggs"], true);

  it.each([
    ["add, then edit", [add, edit]],
    ["tick another line, add, edit", [tickOther, add, edit]],
  ])("%s: every write is stored and the name stays", async (_, steps) => {
    await offline(steps);
    const server = serverOf(rows());

    const pass = await replay(server.client);

    expect(pass).toMatchObject({ removed: steps.length, parked: 0, conflicted: [] });
    expect(server.db.get("milk")).toMatchObject({ name: "Oat milk", version: 2, sortOrder: 1 });
  });

  it("parks an edit as Conflicted when another member changed the line meanwhile", async () => {
    await offline([edit]);
    const server = serverOf(rows());

    server.db.get("milk")!.version = 2;
    const pass = await replay(server.client);

    expect(pass.conflicted.map((entry) => entry.path)).toEqual(["groceries.update"]);
    expect(server.db.get("milk")?.name).toBe("Milk");
    expect((await store.forOwner(OWNER, "conflicted")).map((entry) => entry.path)).toEqual([
      "groceries.update",
    ]);
  });
});
