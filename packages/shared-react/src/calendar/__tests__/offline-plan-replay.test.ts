/**
 * Plan writes made offline, queued by the real Outbox link and replayed in order against a server
 * with the router's and repository's rules: a create starts at version 1, last in its owner's
 * slot; a write at another version changes nothing and answers `stale: true`, a move to where the
 * plan is moves nothing; a move bumps the moved plan alone, lands at its index (none: last) among
 * its owner's slot-mates and renumbers them without bumping; an update bumps its plan, and a
 * delete renumbers without bumping.
 */
import type { inferRouterOutputs } from "@trpc/server";
import { act, renderHook } from "@testing-library/react";
import { observable } from "@trpc/server/observable";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import type { AppRouter } from "@norish/trpc/client";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import type { OutboxEntry } from "../../offline/outbox-types";
import { createOutboxLink } from "../../offline/outbox-link";
import { createOutboxStore } from "../../offline/outbox-store";
import { runReplayPass } from "../../offline/replay";
import { replayOutboxEntry } from "../../offline/replay-client";
import { createMemoryStorage } from "../../offline/testing/memory-storage";
import { useCalendarMutations } from "../use-calendar-mutations";

const sends = vi.hoisted(() => ({
  createItem: vi.fn(),
  moveItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));

const procedure = (mutationFn: (input: unknown) => unknown) => ({
  mutationOptions: (options?: object) => ({ ...options, mutationFn }),
});

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    recipes: {
      list: { pathKey: () => [["recipes", "list"]] },
      get: { queryKey: (input: { id: string }) => [["recipes", "get"], { input, type: "query" }] },
    },
    calendar: {
      listItems: {
        queryKey: (input?: { startISO: string; endISO: string }) =>
          input
            ? [["calendar", "listItems"], { input, type: "query" }]
            : [["calendar", "listItems"]],
      },
      createItem: procedure(sends.createItem),
      moveItem: procedure(sends.moveItem),
      updateItem: procedure(sends.updateItem),
      deleteItem: procedure(sends.deleteItem),
    },
  }),
}));

type Answers = inferRouterOutputs<AppRouter>["calendar"];
type Row = {
  userId: string;
  date: string;
  slot: Slot;
  sortOrder: number;
  version: number;
  title: string;
};
type M = ReturnType<typeof useCalendarMutations>;

const OWNER = "u1";
const HOUSEMATE = "u2";
const RANGE = { startISO: "2026-11-09", endISO: "2026-11-22" };
const RANGE_KEY = [["calendar", "listItems"], { input: RANGE, type: "query" }];

function serverOf(rows: Record<string, Row>, { deletedRecipes = new Set<string>() } = {}) {
  const db = new Map(Object.entries(rows).map(([id, row]) => [id, { ...row }]));
  // A slot is its owner's: a housemate's plans on the same day and slot are not counted.
  const slotOf = (userId: string, date: string, slot: Slot, without?: string) =>
    [...db.entries()]
      .filter(
        ([id, row]) =>
          id !== without && row.userId === userId && row.date === date && row.slot === slot
      )
      .sort(([, a], [, b]) => a.sortOrder - b.sortOrder);
  const renumber = (entries: Array<[string, Row]>) =>
    entries.forEach(([, row], index) => (row.sortOrder = index));

  const client = {
    calendar: {
      createItem: {
        mutate: vi.fn(
          async (input: {
            id: string;
            date: string;
            slot: Slot;
            recipeId?: string;
            title?: string;
          }) => {
            // Its recipe was deleted meanwhile: refused, as a write that will fail again.
            if (input.recipeId && deletedRecipes.has(input.recipeId)) {
              throw Object.assign(new Error("recipe gone"), { data: { httpStatus: 400 } });
            }
            db.set(input.id, {
              userId: OWNER,
              date: input.date,
              slot: input.slot,
              sortOrder: slotOf(OWNER, input.date, input.slot).length,
              version: 1,
              title: input.title ?? "",
            });

            return { id: input.id };
          }
        ),
      },
      moveItem: {
        mutate: vi.fn(
          async (input: {
            itemId: string;
            version: number;
            targetDate: string;
            targetSlot: Slot;
            targetIndex?: number;
          }): Promise<Answers["moveItem"]> => {
            const row = db.get(input.itemId);

            if (!row || row.version !== input.version) {
              return { success: true, moved: false, stale: true };
            }
            if (
              row.date === input.targetDate &&
              row.slot === input.targetSlot &&
              row.sortOrder === input.targetIndex
            ) {
              return { success: true, moved: false, stale: false };
            }
            const source = slotOf(row.userId, row.date, row.slot, input.itemId);
            const target = slotOf(row.userId, input.targetDate, input.targetSlot, input.itemId);

            target.splice(Math.min(input.targetIndex ?? target.length, target.length), 0, [
              input.itemId,
              row,
            ]);
            Object.assign(row, {
              date: input.targetDate,
              slot: input.targetSlot,
              version: row.version + 1,
            });
            renumber(source);
            renumber(target);

            return { success: true, moved: true, stale: false };
          }
        ),
      },
      updateItem: {
        mutate: async (input: {
          itemId: string;
          version: number;
          title: string;
        }): Promise<Answers["updateItem"]> => {
          const row = db.get(input.itemId);

          if (!row || row.version !== input.version) return { success: true, stale: true };
          Object.assign(row, { title: input.title, version: row.version + 1 });

          return { success: true, stale: false };
        },
      },
      deleteItem: {
        mutate: async (input: {
          itemId: string;
          version: number;
        }): Promise<Answers["deleteItem"]> => {
          const row = db.get(input.itemId);

          if (!row) return { success: true, stale: false };
          if (row.version !== input.version) return { success: true, stale: true };
          db.delete(input.itemId);
          renumber(slotOf(row.userId, row.date, row.slot));

          return { success: true, stale: false };
        },
      },
    },
  };

  return { db, client };
}

const rows = (): Record<string, Row> => ({
  soup: {
    userId: OWNER,
    date: "2026-11-11",
    slot: "Dinner",
    sortOrder: 0,
    version: 1,
    title: "Soup",
  },
  salad: {
    userId: OWNER,
    date: "2026-11-11",
    slot: "Dinner",
    sortOrder: 1,
    version: 3,
    title: "Salad",
  },
  toast: {
    userId: OWNER,
    date: "2026-11-12",
    slot: "Dinner",
    sortOrder: 0,
    version: 2,
    title: "Toast",
  },
  pie: {
    userId: HOUSEMATE,
    date: "2026-11-12",
    slot: "Dinner",
    sortOrder: 0,
    version: 1,
    title: "Pie",
  },
});

const cached = (): PlannedItemFromQuery[] =>
  Object.entries(rows()).map(([id, row]) => ({
    id,
    ...row,
    itemType: "note",
    recipeId: null,
    recipeName: null,
    recipeImage: null,
    servings: null,
    calories: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));

describe("plan writes made offline, replayed", () => {
  const store = createOutboxStore(createMemoryStorage().outbox);
  // Unreachable: the real link admits the write to the Outbox, then fails it as Queued.
  const link = createOutboxLink({ store, owner: () => OWNER, replayHeaderValue: "test-outbox" })(
    {} as never
  );

  beforeEach(async () => {
    for (const entry of await store.loadAll()) await store.remove(entry.seq);
    for (const [path, send] of Object.entries(sends)) {
      send.mockReset();
      send.mockImplementation(
        (input: unknown) =>
          new Promise((resolve, reject) => {
            const op = { id: 0, type: "mutation", path: `calendar.${path}`, input, context: {} };
            const unreachable = () =>
              observable((observer) => observer.error(new TypeError("Failed to fetch")));

            link({ op, next: unreachable } as never).subscribe({ next: resolve, error: reject });
          })
      );
    }
  });

  /** Each step on the cache the last left; resolves to what the range then shows. */
  async function offline(steps: Array<(m: M, shown: PlannedItemFromQuery[]) => void>) {
    const queryClient = createTestQueryClient();
    const shown = () => queryClient.getQueryData<PlannedItemFromQuery[]>(RANGE_KEY) ?? [];

    queryClient.setQueryData(RANGE_KEY, cached());

    for (const step of steps) {
      const { result, unmount } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient, fakePlatformAdapter()),
      });

      act(() => step(result.current, shown()));
      await act(async () => {
        await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
      });
      unmount();
    }

    return shown();
  }

  const replay = (client: ReturnType<typeof serverOf>["client"]) =>
    runReplayPass({
      store,
      ownerId: OWNER,
      submit: (entry: OutboxEntry) => replayOutboxEntry(client, entry, "test-outbox"),
    });

  /** The id the queued create minted for its plan. */
  const plannedId = async () =>
    (
      (await store.loadAll()).find((entry) => entry.path === "calendar.createItem")?.input as {
        id: string;
      }
    ).id;

  it.each([
    [
      "move, then move again",
      [
        (m: M) => m.moveItem("soup", "2026-11-12", "Dinner", 1),
        (m: M) => m.moveItem("soup", "2026-11-13", "Dinner", 0),
      ],
      { soup: { date: "2026-11-13", version: 3 }, salad: { sortOrder: 0, version: 3 } },
    ],
    [
      "move, then change the slot",
      [
        (m: M) => m.moveItem("soup", "2026-11-12", "Dinner", 1),
        (m: M) => m.moveItem("soup", "2026-11-12", "Lunch", 0),
      ],
      { soup: { date: "2026-11-12", slot: "Lunch", version: 3 }, toast: { version: 2 } },
    ],
    [
      "two plans moved into the same slot",
      [
        (m: M) => m.moveItem("soup", "2026-11-12", "Dinner", 1),
        (m: M) => m.moveItem("salad", "2026-11-12", "Dinner", 2),
      ],
      {
        toast: { sortOrder: 0, version: 2 },
        soup: { sortOrder: 1, version: 2 },
        salad: { sortOrder: 2, version: 4 },
      },
    ],
    [
      "a note renamed, then moved",
      [
        (m: M) => m.updateItem("soup", "Leek soup"),
        (m: M) => m.moveItem("soup", "2026-11-12", "Dinner", 1),
      ],
      { soup: { title: "Leek soup", date: "2026-11-12", version: 3 } },
    ],
  ] as const)("%s: every write is stored", async (_, steps, expected) => {
    await offline([...steps]);
    const server = serverOf(rows());

    const pass = await replay(server.client);

    expect(pass).toMatchObject({ removed: steps.length, parked: 0, conflicted: [] });
    for (const [id, row] of Object.entries(expected)) {
      expect(server.db.get(id)).toMatchObject(row);
    }
  });

  it("a note's text and move saved together in one tick: both stored, the move at the version the text left", async () => {
    const shown = await offline([
      (m) =>
        m.saveItem("soup", {
          title: "Leek soup",
          move: { date: "2026-11-12", slot: "Lunch" },
        }),
    ]);

    expect(shown.find((item) => item.id === "soup")).toMatchObject({
      title: "Leek soup",
      date: "2026-11-12",
      slot: "Lunch",
      version: 3,
    });
    const server = serverOf(rows());

    expect(await replay(server.client)).toMatchObject({ removed: 2, parked: 0, conflicted: [] });
    expect(server.db.get("soup")).toMatchObject({
      title: "Leek soup",
      date: "2026-11-12",
      slot: "Lunch",
      version: 3,
    });
  });

  it("move, then remove: the plan is gone and its slot-mates keep their versions", async () => {
    await offline([
      (m) => m.moveItem("soup", "2026-11-12", "Dinner", 1),
      (m) => m.deleteItem("soup"),
    ]);
    const server = serverOf(rows());

    expect(await replay(server.client)).toMatchObject({ removed: 2, conflicted: [] });
    expect(server.db.has("soup")).toBe(false);
    expect(server.db.get("toast")).toMatchObject({ sortOrder: 0, version: 2 });
  });

  it("plan, then move the planned item: shown at once on its new day, and both stored", async () => {
    const leftovers = (shown: PlannedItemFromQuery[]) =>
      shown.find((item) => item.title === "Leftovers");
    const shown = await offline([
      (m) => m.planNote("2026-11-11", "Lunch", "Leftovers"),
      (m, before) => m.moveItem(leftovers(before)!.id, "2026-11-12", "Lunch"),
    ]);
    const id = await plannedId();

    expect(leftovers(shown)).toMatchObject({ id, date: "2026-11-12", version: 2 });
    const server = serverOf(rows());

    expect(await replay(server.client)).toMatchObject({ removed: 2, conflicted: [] });
    expect(server.db.get(id)).toMatchObject({ date: "2026-11-12", slot: "Lunch", version: 2 });
  });

  it("lands a move with no index last among its owner's plans, a housemate's not counted", async () => {
    await offline([(m) => m.moveItem("soup", "2026-11-12", "Dinner")]);
    const server = serverOf(rows());

    expect(await replay(server.client)).toMatchObject({ removed: 1, conflicted: [] });
    expect(server.db.get("soup")).toMatchObject({ sortOrder: 1, version: 2 });
    expect(server.db.get("pie")).toMatchObject({ sortOrder: 0, version: 1 });
  });

  it("parks a move back to where the plan is as Conflicted when the plan moved on meanwhile", async () => {
    await offline([(m) => m.moveItem("toast", "2026-11-12", "Dinner", 0)]);
    const server = serverOf(rows());

    server.db.get("toast")!.version = 3;

    expect((await replay(server.client)).conflicted.map((entry) => entry.path)).toEqual([
      "calendar.moveItem",
    ]);
  });

  it("queues a create under its plan's id", async () => {
    await offline([(m) => m.planNote("2026-11-11", "Lunch", "Leftovers")]);
    const [entry] = await store.loadAll();

    expect(entry).toMatchObject({ path: "calendar.createItem", entityId: await plannedId() });
  });

  it("parks a move behind its refused create, never sending it", async () => {
    await offline([(m) => m.planRecipe("2026-11-11", "Lunch", "gone-recipe")]);
    const id = await plannedId();

    await offline([(m) => m.moveItem(id, "2026-11-12", "Lunch")]);
    const server = serverOf(rows(), { deletedRecipes: new Set(["gone-recipe"]) });

    expect(await replay(server.client)).toMatchObject({ removed: 0, parked: 2, conflicted: [] });
    expect(server.client.calendar.moveItem.mutate).not.toHaveBeenCalled();
    expect((await store.loadAll()).map(({ path, parkedReason }) => [path, parkedReason])).toEqual([
      ["calendar.createItem", "deterministic"],
      ["calendar.moveItem", "dependency"],
    ]);
  });

  it("parks a move as Conflicted when another member moved the plan meanwhile", async () => {
    await offline([
      (m) => m.moveItem("soup", "2026-11-12", "Dinner", 1),
      (m) => m.moveItem("toast", "2026-11-13", "Dinner", 0),
    ]);
    const server = serverOf(rows());

    server.db.get("soup")!.version = 2;
    const pass = await replay(server.client);

    expect(pass.conflicted.map((entry) => entry.path)).toEqual(["calendar.moveItem"]);
    expect(server.db.get("soup")).toMatchObject({ date: "2026-11-11" });
    expect(server.db.get("toast")).toMatchObject({ date: "2026-11-13", version: 3 });
  });
});
