/**
 * A planned item reaches every cached calendar range — from the actor's own
 * create result and from the realtime echo alike — so a range cached for
 * another screen shows it without waiting for a refetch (issue #583).
 */

import { act } from "react";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import type { PlannedItemWithRecipePayload } from "@norish/shared/contracts/zod";

import { renderHookWithClient } from "../../../__tests__/hooks/render-hook";
import { trackedEvent } from "../../../__tests__/realtime/tracked-event";
import { calendarRangeOfQueryKey } from "../calendar-cache-merge";
import { useCalendarMutations } from "../use-calendar-mutations";
import { useCalendarQuery } from "../use-calendar-query";
import { useCalendarSubscription } from "../use-calendar-subscription";

const useSubscriptionMock = vi.hoisted(() => vi.fn());
const createItemMutate = vi.hoisted(() => vi.fn());

vi.mock("@trpc/tanstack-react-query", async () => {
  const actual = await vi.importActual<typeof import("@trpc/tanstack-react-query")>(
    "@trpc/tanstack-react-query"
  );

  return { ...actual, useSubscription: useSubscriptionMock };
});

const PATH = ["calendar", "listItems"];
const rangeKey = (startISO: string, endISO: string) => [
  PATH,
  { input: { startISO, endISO }, type: "query" },
];
const THIS_WEEK = { startISO: "2026-09-21", endISO: "2026-09-27" };
const CALENDAR_PAGE = { startISO: "2026-09-07", endISO: "2026-10-11" };
const LAST_MONTH = { startISO: "2026-08-01", endISO: "2026-08-31" };

function procedure(name: string) {
  return { subscriptionOptions: (_input: undefined, opts: object) => ({ name, ...opts }) };
}

const trpc = {
  calendar: {
    listItems: {
      pathKey: () => [PATH],
      queryKey: (input?: { startISO: string; endISO: string }) =>
        input ? rangeKey(input.startISO, input.endISO) : [PATH],
      // Every read fails, as it does Offline.
      queryOptions: (input: { startISO: string; endISO: string }, opts: object) => ({
        queryKey: rangeKey(input.startISO, input.endISO),
        queryFn: () => Promise.reject(new Error("Offline")),
        ...opts,
      }),
    },
    createItem: {
      mutationOptions: (opts: object) => ({ mutationKey: [["calendar", "createItem"]], ...opts }),
    },
    deleteItem: {
      mutationOptions: (opts: object) => ({ mutationKey: [["calendar", "deleteItem"]], ...opts }),
    },
    moveItem: {
      mutationOptions: (opts: object) => ({ mutationKey: [["calendar", "moveItem"]], ...opts }),
    },
    updateItem: {
      mutationOptions: (opts: object) => ({ mutationKey: [["calendar", "updateItem"]], ...opts }),
    },
    onItemCreated: procedure("onItemCreated"),
    onItemDeleted: procedure("onItemDeleted"),
    onItemMoved: procedure("onItemMoved"),
    onItemUpdated: procedure("onItemUpdated"),
    onFailed: procedure("onFailed"),
  },
  recipes: { onUpdated: procedure("recipes.onUpdated") },
};

vi.mock("../../trpc", () => ({ useTRPC: () => trpc }));

function payload(
  overrides: Partial<PlannedItemWithRecipePayload> = {}
): PlannedItemWithRecipePayload {
  return {
    id: "item-1",
    userId: "user-1",
    date: "2026-09-23",
    slot: "Dinner",
    sortOrder: 0,
    itemType: "recipe",
    recipeId: "recipe-1",
    title: null,
    version: 1,
    recipeName: "Stew",
    recipeImage: null,
    servings: 4,
    calories: null,
    ...overrides,
  } as PlannedItemWithRecipePayload;
}

function cachedItem(overrides: Partial<PlannedItemFromQuery> = {}): PlannedItemFromQuery {
  return {
    ...payload(),
    recipeId: "recipe-0",
    id: "item-0",
    date: "2026-09-22",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  } as PlannedItemFromQuery;
}

function idsIn(queryClient: QueryClient, range: { startISO: string; endISO: string }) {
  return (
    queryClient.getQueryData<PlannedItemFromQuery[]>(rangeKey(range.startISO, range.endISO)) ?? []
  ).map((item) => item.id);
}

describe("calendarRangeOfQueryKey", () => {
  it("reads the range a listItems key was made for, and nothing from other shapes", () => {
    expect(calendarRangeOfQueryKey(rangeKey("2026-09-01", "2026-09-30"))).toEqual({
      startISO: "2026-09-01",
      endISO: "2026-09-30",
    });
    expect(calendarRangeOfQueryKey([PATH])).toBeNull();
    expect(calendarRangeOfQueryKey([PATH, { type: "query" }])).toBeNull();
    expect(calendarRangeOfQueryKey([PATH, { input: { startISO: 1 }, type: "query" }])).toBeNull();
  });
});

describe("calendar cache convergence across ranges", () => {
  let queryClient: QueryClient;
  let unmount: () => void = () => {};

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useSubscriptionMock.mockReset();
    createItemMutate.mockReset();
    // The dashboard's week and the calendar page's range are both cached; a
    // range that never fetched is not, and stays that way.
    queryClient.setQueryData(rangeKey(THIS_WEEK.startISO, THIS_WEEK.endISO), [cachedItem()]);
    queryClient.setQueryData(rangeKey(CALENDAR_PAGE.startISO, CALENDAR_PAGE.endISO), [
      cachedItem(),
    ]);
    queryClient.setQueryData(rangeKey(LAST_MONTH.startISO, LAST_MONTH.endISO), []);
  });

  afterEach(() => {
    unmount();
    unmount = () => {};
  });

  function mountSubscription() {
    ({ unmount } = renderHookWithClient(queryClient, () => useCalendarSubscription()));
  }

  function handler(name: string) {
    const call = useSubscriptionMock.mock.calls.find(
      ([options]) => (options as { name: string }).name === name
    );

    if (!call) throw new Error(`no subscription named ${name}`);

    return (call[0] as { onData: (data: unknown) => void }).onData;
  }

  it("places an echoed create in every cached range its date falls in", () => {
    mountSubscription();

    act(() => handler("onItemCreated")(trackedEvent({ item: payload() })));

    expect(idsIn(queryClient, THIS_WEEK)).toEqual(["item-0", "item-1"]);
    expect(idsIn(queryClient, CALENDAR_PAGE)).toEqual(["item-0", "item-1"]);
    expect(idsIn(queryClient, LAST_MONTH)).toEqual([]);
    expect(queryClient.getQueryData([PATH])).toBeUndefined();
  });

  it("moves an edited item between ranges by its new date", () => {
    mountSubscription();
    act(() => handler("onItemCreated")(trackedEvent({ item: payload() })));

    act(() =>
      handler("onItemUpdated")(trackedEvent({ item: payload({ date: "2026-10-05", version: 2 }) }))
    );

    // Out of this week, still on the calendar page's range, at the new version.
    expect(idsIn(queryClient, THIS_WEEK)).toEqual(["item-0"]);
    expect(idsIn(queryClient, CALENDAR_PAGE)).toEqual(["item-0", "item-1"]);
    expect(
      queryClient
        .getQueryData<PlannedItemFromQuery[]>(
          rangeKey(CALENDAR_PAGE.startISO, CALENDAR_PAGE.endISO)
        )
        ?.find((item) => item.id === "item-1")?.version
    ).toBe(2);
  });

  it("lands a move echo in every cached range, leaving and entering ranges by date", () => {
    mountSubscription();
    const moved = (date: string, version: number) =>
      trackedEvent({
        item: payload({ id: "item-0", date, slot: "Lunch", version }),
        targetSlotItems: [{ id: "item-0", sortOrder: 0 }],
        sourceSlotItems: [],
        oldDate: "2026-09-22",
        oldSlot: "Dinner",
        oldSortOrder: 0,
      });

    act(() => handler("onItemMoved")(moved("2026-09-24", 2)));

    for (const range of [THIS_WEEK, CALENDAR_PAGE]) {
      expect(
        queryClient.getQueryData<PlannedItemFromQuery[]>(rangeKey(range.startISO, range.endISO))
      ).toEqual([expect.objectContaining({ id: "item-0", date: "2026-09-24", version: 2 })]);
    }

    act(() => handler("onItemMoved")(moved("2026-08-15", 3)));

    expect(idsIn(queryClient, THIS_WEEK)).toEqual([]);
    expect(idsIn(queryClient, CALENDAR_PAGE)).toEqual([]);
    expect(
      queryClient.getQueryData<PlannedItemFromQuery[]>(
        rangeKey(LAST_MONTH.startISO, LAST_MONTH.endISO)
      )
    ).toEqual([expect.objectContaining({ id: "item-0", date: "2026-08-15", version: 3 })]);
  });

  it("drops a deleted item from every cached range", () => {
    mountSubscription();

    act(() =>
      handler("onItemDeleted")(
        trackedEvent({ itemId: "item-0", date: "2026-09-22", slot: "Dinner" })
      )
    );

    expect(idsIn(queryClient, THIS_WEEK)).toEqual([]);
    expect(idsIn(queryClient, CALENDAR_PAGE)).toEqual([]);
  });

  it("places the actor's own created item from the mutation result, and the echo is then a no-op", async () => {
    let mutations: ReturnType<typeof useCalendarMutations> | null = null;

    queryClient.setMutationDefaults([["calendar", "createItem"]], {
      mutationFn: async () => ({ id: "item-1", item: payload() }),
    });

    ({ unmount } = renderHookWithClient(queryClient, () => {
      mutations = useCalendarMutations();
      useCalendarSubscription();
    }));

    await act(async () => {
      mutations!.createItem("2026-09-23", "Dinner", "recipe", "recipe-1");
      await vi.waitFor(() => expect(idsIn(queryClient, CALENDAR_PAGE)).toContain("item-1"));
    });

    expect(idsIn(queryClient, THIS_WEEK)).toEqual(["item-0", "item-1"]);

    act(() => handler("onItemCreated")(trackedEvent({ item: payload() })));

    expect(idsIn(queryClient, THIS_WEEK)).toEqual(["item-0", "item-1"]);
    expect(idsIn(queryClient, CALENDAR_PAGE)).toEqual(["item-0", "item-1"]);
  });
});

describe("a delete, move or update with no range", () => {
  let queryClient: QueryClient;
  let unmount: () => void = () => {};
  let mutations: ReturnType<typeof useCalendarMutations>;
  const sent = vi.fn();

  const ITEMS = [
    cachedItem({ id: "item-0", date: "2026-09-22", sortOrder: 0, version: 2 }),
    cachedItem({ id: "item-2", date: "2026-09-22", sortOrder: 1, title: "Soup" }),
  ];

  // Each write answers with `answer`, or refuses with it when it is an Error.
  function mount(answer: unknown) {
    for (const name of ["deleteItem", "moveItem", "updateItem"]) {
      queryClient.setMutationDefaults([["calendar", name]], {
        mutationFn: async (input: unknown) => {
          sent(name, input);
          if (answer instanceof Error) throw answer;

          return answer;
        },
      });
    }
    ({ unmount } = renderHookWithClient(queryClient, () => {
      mutations = useCalendarMutations();
    }));
  }

  async function settle() {
    await act(async () => {
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    });
  }

  function itemsIn(range: { startISO: string; endISO: string }) {
    return queryClient.getQueryData<PlannedItemFromQuery[]>(rangeKey(range.startISO, range.endISO));
  }

  const writes = {
    delete: () => mutations.deleteItem("item-0"),
    move: () => mutations.moveItem("item-0", "2026-10-05", "Lunch", 0),
    update: () => mutations.updateItem("item-0", "Leftovers"),
  };

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    sent.mockReset();
    queryClient.setQueryData(rangeKey(THIS_WEEK.startISO, THIS_WEEK.endISO), ITEMS);
    queryClient.setQueryData(rangeKey(CALENDAR_PAGE.startISO, CALENDAR_PAGE.endISO), ITEMS);
  });

  afterEach(() => {
    unmount();
    unmount = () => {};
  });

  it("deletes from both cached ranges, sending the cached version", async () => {
    mount({ success: true });
    act(() => writes.delete());
    await settle();

    expect(idsIn(queryClient, THIS_WEEK)).toEqual(["item-2"]);
    expect(idsIn(queryClient, CALENDAR_PAGE)).toEqual(["item-2"]);
    expect(sent).toHaveBeenCalledWith("deleteItem", { itemId: "item-0", version: 2 });
  });

  it("moves in both cached ranges, leaving the one its new date is outside", async () => {
    mount({ success: true, moved: true });
    act(() => writes.move());
    await settle();

    // 2026-10-05 is past this week but on the calendar page's range.
    expect(itemsIn(THIS_WEEK)).toEqual([expect.objectContaining({ id: "item-2", sortOrder: 0 })]);
    expect(itemsIn(CALENDAR_PAGE)).toEqual([
      expect.objectContaining({ id: "item-2", sortOrder: 0 }),
      expect.objectContaining({ id: "item-0", date: "2026-10-05", slot: "Lunch", sortOrder: 0 }),
    ]);
    expect(sent).toHaveBeenCalledWith("moveItem", expect.objectContaining({ version: 2 }));
  });

  it("updates in both cached ranges", async () => {
    mount({ success: true });
    act(() => writes.update());
    await settle();

    for (const range of [THIS_WEEK, CALENDAR_PAGE]) {
      expect(itemsIn(range)?.find((item) => item.id === "item-0")?.title).toBe("Leftovers");
    }
  });

  it.each(Object.keys(writes) as (keyof typeof writes)[])(
    "rolls both ranges back when a %s fails",
    async (write) => {
      mount(new Error("refused"));
      act(() => writes[write]());
      await settle();

      expect(itemsIn(THIS_WEEK)).toEqual(ITEMS);
      expect(itemsIn(CALENDAR_PAGE)).toEqual(ITEMS);
    }
  );

  it.each(Object.keys(writes) as (keyof typeof writes)[])(
    "keeps a Queued %s in both ranges",
    async (write) => {
      // Backend unreachable: the write sits in the Outbox (ADR-0009).
      mount(new TypeError("Failed to fetch"));
      act(() => writes[write]());
      await settle();

      expect(itemsIn(THIS_WEEK)).not.toEqual(ITEMS);
      expect(itemsIn(CALENDAR_PAGE)).not.toEqual(ITEMS);
    }
  );

  it.each(Object.keys(writes) as (keyof typeof writes)[])(
    "sends the newest cached copy's version with a %s",
    async (write) => {
      // A narrower range left behind holds an older copy, and was cached first.
      queryClient.clear();
      queryClient.setQueryData(rangeKey(THIS_WEEK.startISO, THIS_WEEK.endISO), [
        cachedItem({ id: "item-0", date: "2026-09-22", version: 1 }),
      ]);
      queryClient.setQueryData(rangeKey(CALENDAR_PAGE.startISO, CALENDAR_PAGE.endISO), [
        cachedItem({ id: "item-0", date: "2026-09-22", version: 2, title: "Newer" }),
      ]);
      mount({ success: true });
      act(() => writes[write]());
      await settle();

      expect(sent).toHaveBeenCalledWith(`${write}Item`, expect.objectContaining({ version: 2 }));
      if (write === "move") {
        expect(itemsIn(CALENDAR_PAGE)).toEqual([
          expect.objectContaining({ id: "item-0", title: "Newer", version: 2 }),
        ]);
      }
    }
  );

  it("rereads both ranges after rolling back a failed delete", async () => {
    mount(new Error("refused"));
    act(() => writes.delete());
    await settle();

    for (const range of [THIS_WEEK, CALENDAR_PAGE]) {
      expect(itemsIn(range)).toEqual(ITEMS);
      expect(queryClient.getQueryState(rangeKey(range.startISO, range.endISO))?.isInvalidated).toBe(
        true
      );
    }
  });

  it("keeps both writes started in one tick", async () => {
    mount({ success: true });
    // The note editor renames, then moves, in one handler.
    act(() => {
      mutations.updateItem("item-0", "Leftovers");
      mutations.moveItem("item-0", "2026-09-24", "Lunch", 0);
    });
    await settle();

    for (const range of [THIS_WEEK, CALENDAR_PAGE]) {
      expect(itemsIn(range)?.find((item) => item.id === "item-0")).toEqual(
        expect.objectContaining({ title: "Leftovers", date: "2026-09-24", slot: "Lunch" })
      );
    }
  });

  it("rereads both ranges after a stale write", async () => {
    mount({ success: true, stale: true });
    act(() => writes.update());
    await settle();

    for (const range of [THIS_WEEK, CALENDAR_PAGE]) {
      expect(queryClient.getQueryState(rangeKey(range.startISO, range.endISO))?.isInvalidated).toBe(
        true
      );
    }
  });
});

describe("a range the cache has not read yet", () => {
  it("starts from the items cached for its days, and keeps them when its own read fails", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // The calendar page widens its range twelve days into the past as it is
    // scrolled, and Offline the wider range can never be read.
    const WIDER = { startISO: "2026-08-26", endISO: CALENDAR_PAGE.endISO };
    let items: PlannedItemFromQuery[] = [];

    queryClient.setQueryData(rangeKey(CALENDAR_PAGE.startISO, CALENDAR_PAGE.endISO), [
      cachedItem({ id: "item-0", date: "2026-09-22" }),
    ]);
    queryClient.setQueryData(rangeKey(THIS_WEEK.startISO, THIS_WEEK.endISO), [
      cachedItem({ id: "item-0", date: "2026-09-22" }),
    ]);
    queryClient.setQueryData(rangeKey("2026-10-12", "2026-10-18"), [
      cachedItem({ id: "item-later", date: "2026-10-14" }),
    ]);

    const { unmount } = renderHookWithClient(queryClient, () => {
      items = useCalendarQuery(WIDER.startISO, WIDER.endISO).items;
    });

    expect(items.map((item) => item.id)).toEqual(["item-0"]);
    await act(async () => {
      await vi.waitFor(() =>
        expect(queryClient.getQueryState(rangeKey(WIDER.startISO, WIDER.endISO))?.status).toBe(
          "error"
        )
      );
    });
    expect(items.map((item) => item.id)).toEqual(["item-0"]);
    unmount();
  });
});
