/**
 * Plan writes made offline, replayed in order against a server with the repository's version
 * rules: a create starts at version 1, a move bumps the moved plan alone and renumbers its
 * slot-mates without bumping them, an update bumps its plan, a delete renumbers without bumping,
 * and a write at another version changes nothing and answers `stale: true`.
 */
import type { inferRouterOutputs } from "@trpc/server";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import type { AppRouter } from "@norish/trpc/client";
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
type Row = { date: string; slot: Slot; sortOrder: number; version: number; title: string };
type M = ReturnType<typeof useCalendarMutations>;

const OWNER = "u1";
const RANGE = { startISO: "2026-11-09", endISO: "2026-11-22" };
const RANGE_KEY = [["calendar", "listItems"], { input: RANGE, type: "query" }];

function serverOf(rows: Record<string, Row>) {
  const db = new Map(Object.entries(rows).map(([id, row]) => [id, { ...row }]));
  const slotOf = (date: string, slot: Slot, without?: string) =>
    [...db.entries()]
      .filter(([id, row]) => id !== without && row.date === date && row.slot === slot)
      .sort(([, a], [, b]) => a.sortOrder - b.sortOrder);
  const renumber = (entries: Array<[string, Row]>) =>
    entries.forEach(([, row], index) => (row.sortOrder = index));

  const client = {
    calendar: {
      createItem: {
        mutate: async (input: { id: string; date: string; slot: Slot; title?: string }) => {
          db.set(input.id, {
            date: input.date,
            slot: input.slot,
            sortOrder: slotOf(input.date, input.slot).length,
            version: 1,
            title: input.title ?? "",
          });

          return { id: input.id };
        },
      },
      moveItem: {
        mutate: async (input: {
          itemId: string;
          version: number;
          targetDate: string;
          targetSlot: Slot;
          targetIndex: number;
        }): Promise<Answers["moveItem"]> => {
          const row = db.get(input.itemId);

          if (!row || row.version !== input.version) {
            return { success: true, moved: false, stale: true };
          }
          const source = slotOf(row.date, row.slot, input.itemId);
          const target = slotOf(input.targetDate, input.targetSlot, input.itemId);

          target.splice(input.targetIndex, 0, [input.itemId, row]);
          Object.assign(row, {
            date: input.targetDate,
            slot: input.targetSlot,
            version: row.version + 1,
          });
          renumber(source);
          renumber(target);

          return { success: true, moved: true, stale: false };
        },
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
          renumber(slotOf(row.date, row.slot));

          return { success: true, stale: false };
        },
      },
    },
  };

  return { db, client };
}

const rows = (): Record<string, Row> => ({
  soup: { date: "2026-11-11", slot: "Dinner", sortOrder: 0, version: 1, title: "Soup" },
  salad: { date: "2026-11-11", slot: "Dinner", sortOrder: 1, version: 3, title: "Salad" },
  toast: { date: "2026-11-12", slot: "Dinner", sortOrder: 0, version: 2, title: "Toast" },
});

const cached = (): PlannedItemFromQuery[] =>
  Object.entries(rows()).map(([id, row]) => ({
    id,
    userId: OWNER,
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
          path: `calendar.${path}`,
          input: structuredClone(input),
          entityId: null,
          operationId: null,
          headers: {},
        });
        throw new TypeError("Failed to fetch");
      });
    }
  });

  async function offline(steps: Array<(m: M) => void>) {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(RANGE_KEY, cached());

    for (const step of steps) {
      const { result, unmount } = renderHook(() => useCalendarMutations(), {
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

  it("plan, then move the planned item: both are stored", async () => {
    await offline([(m) => m.planNote("2026-11-11", "Lunch", "Leftovers")]);
    const id = await plannedId();

    await offline([(m) => m.moveItem(id, "2026-11-12", "Lunch", 0)]);
    const server = serverOf(rows());

    expect(await replay(server.client)).toMatchObject({ removed: 2, conflicted: [] });
    expect(server.db.get(id)).toMatchObject({ date: "2026-11-12", slot: "Lunch", version: 2 });
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
