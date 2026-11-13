// A planned item reaches every cached range from the actor's own result and the echo
// alike, so a range cached for another screen shows it without a refetch (#583).

import { act } from "react";
import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import type { PlannedItemWithRecipePayload } from "@norish/shared/contracts/zod";

import { renderHookWithClient } from "../../../__tests__/hooks/render-hook";
import { trackedEvent } from "../../../__tests__/realtime/tracked-event";
import { calendarRangeOfQueryKey, upsertItemInRange } from "../calendar-cache-merge";
import { useCalendarMutations } from "../use-calendar-mutations";
import { useCalendarQuery } from "../use-calendar-query";
import { useCalendarSubscription } from "../use-calendar-subscription";

const useSubscriptionMock = vi.hoisted(() => vi.fn());
const createItemMutate = vi.hoisted(() => vi.fn());
// What the server answers for a range; every read fails by default, as it does Offline.
const readRange = vi.hoisted(() => vi.fn());

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
      queryOptions: (input: { startISO: string; endISO: string }, opts: object) => ({
        queryKey: rangeKey(input.startISO, input.endISO),
        queryFn: () => readRange(input),
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

beforeEach(() => {
  readRange.mockReset();
  readRange.mockRejectedValue(new Error("Offline"));
});

const rangeKeyOf = (range: { startISO: string; endISO: string }) =>
  rangeKey(range.startISO, range.endISO);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

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

  it("leaves a range holding neither date of a move echo unchanged", () => {
    const august = [cachedItem({ id: "item-aug", date: "2026-08-10", sortOrder: 0 })];

    queryClient.setQueryData(rangeKeyOf(LAST_MONTH), august);
    mountSubscription();

    act(() =>
      handler("onItemMoved")(
        trackedEvent({
          item: payload({ id: "item-0", date: "2026-09-24", slot: "Lunch", version: 2 }),
          targetSlotItems: [{ id: "item-0", sortOrder: 0 }],
          sourceSlotItems: [],
          oldDate: "2026-09-22",
          oldSlot: "Dinner",
          oldSortOrder: 0,
        })
      )
    );

    expect(queryClient.getQueryData(rangeKeyOf(LAST_MONTH))).toEqual(august);
  });

  it("gives slot-mates in every range the order a move echo sends", () => {
    const items = [
      cachedItem({ id: "item-0", date: "2026-09-22", slot: "Dinner", sortOrder: 0 }),
      cachedItem({ id: "item-a", date: "2026-09-22", slot: "Dinner", sortOrder: 1 }),
      cachedItem({ id: "item-b", date: "2026-09-24", slot: "Lunch", sortOrder: 0 }),
    ];

    queryClient.setQueryData(rangeKeyOf(THIS_WEEK), items);
    queryClient.setQueryData(rangeKeyOf(CALENDAR_PAGE), items);
    mountSubscription();

    act(() =>
      handler("onItemMoved")(
        trackedEvent({
          item: payload({ id: "item-0", date: "2026-09-24", slot: "Lunch", version: 2 }),
          targetSlotItems: [
            { id: "item-0", sortOrder: 0 },
            { id: "item-b", sortOrder: 1 },
          ],
          sourceSlotItems: [{ id: "item-a", sortOrder: 0 }],
          oldDate: "2026-09-22",
          oldSlot: "Dinner",
          oldSortOrder: 0,
        })
      )
    );

    for (const range of [THIS_WEEK, CALENDAR_PAGE]) {
      expect(
        queryClient
          .getQueryData<PlannedItemFromQuery[]>(rangeKeyOf(range))
          ?.map(({ id, sortOrder }) => [id, sortOrder])
      ).toEqual([
        ["item-a", 0],
        ["item-0", 0],
        ["item-b", 1],
      ]);
    }
  });

  it("keeps a flagged range no component shows flagged through an echo, so mounting it reads", async () => {
    void queryClient.invalidateQueries({ queryKey: rangeKeyOf(THIS_WEEK), exact: true });
    mountSubscription();
    act(() => handler("onItemCreated")(trackedEvent({ item: payload() })));

    const server = [cachedItem({ id: "item-server", date: "2026-09-24" })];
    let items: PlannedItemFromQuery[] = [];

    readRange.mockResolvedValue(server);
    const view = renderHookWithClient(queryClient, () => {
      items = Object.values(useCalendarQuery(THIS_WEEK).calendarData).flat();
    });

    await act(async () => {
      await vi.waitFor(() => expect(items).toEqual(server));
    });
    view.unmount();
  });

  it("rereads a range whose read was in flight when a recipe was renamed", async () => {
    const first = deferred<PlannedItemFromQuery[]>();

    readRange.mockReturnValueOnce(first.promise).mockResolvedValue([cachedItem()]);
    mountSubscription();
    void queryClient.invalidateQueries({ queryKey: rangeKeyOf(THIS_WEEK), exact: true });
    const view = renderHookWithClient(queryClient, () => useCalendarQuery(THIS_WEEK));

    expect(readRange).toHaveBeenCalledTimes(1);
    act(() => handler("recipes.onUpdated")(trackedEvent({ recipe: { id: "recipe-0" } })));
    await act(async () => first.resolve([cachedItem({ recipeName: "Old" })]));

    await act(async () => {
      await vi.waitFor(() => expect(readRange).toHaveBeenCalledTimes(2));
    });
    view.unmount();
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
      mutations!.planRecipe("2026-09-23", "Dinner", "recipe-1");
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

  // Overlapping ranges that differ: only the calendar page's holds item-3.
  const WEEK_ITEMS = [
    cachedItem({ id: "item-0", date: "2026-09-22", sortOrder: 0, version: 2 }),
    cachedItem({ id: "item-2", date: "2026-09-22", sortOrder: 1, title: "Soup" }),
  ];
  const PAGE_ITEMS = [
    ...WEEK_ITEMS,
    cachedItem({ id: "item-3", date: "2026-10-05", slot: "Lunch", sortOrder: 0, title: "Pasta" }),
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
  const WRITES = Object.keys(writes) as (keyof typeof writes)[];

  // What each range holds once a write lands; 2026-10-05 is past this week, on the page.
  const item = (fields: Partial<PlannedItemFromQuery>) => expect.objectContaining(fields);
  const landed = {
    delete: {
      week: [item({ id: "item-2", sortOrder: 1 })],
      page: [item({ id: "item-2", sortOrder: 1 }), item({ id: "item-3", sortOrder: 0 })],
    },
    move: {
      // The week held item-0, so it keeps it past its edge until its own read.
      week: [
        item({ id: "item-2", sortOrder: 0 }),
        item({ id: "item-0", date: "2026-10-05", slot: "Lunch", sortOrder: 0 }),
      ],
      page: [
        item({ id: "item-2", sortOrder: 0 }),
        item({ id: "item-0", date: "2026-10-05", slot: "Lunch", sortOrder: 0 }),
        item({ id: "item-3", date: "2026-10-05", slot: "Lunch", sortOrder: 1 }),
      ],
    },
    update: {
      week: [item({ id: "item-0", title: "Leftovers" }), item({ id: "item-2", title: "Soup" })],
      page: [
        item({ id: "item-0", title: "Leftovers" }),
        item({ id: "item-2", title: "Soup" }),
        item({ id: "item-3", title: "Pasta" }),
      ],
    },
  };

  function expectLanded(write: keyof typeof writes) {
    expect(itemsIn(THIS_WEEK)).toEqual(landed[write].week);
    expect(itemsIn(CALENDAR_PAGE)).toEqual(landed[write].page);
  }

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    sent.mockReset();
    queryClient.setQueryData(rangeKey(THIS_WEEK.startISO, THIS_WEEK.endISO), WEEK_ITEMS);
    queryClient.setQueryData(rangeKey(CALENDAR_PAGE.startISO, CALENDAR_PAGE.endISO), PAGE_ITEMS);
  });

  afterEach(() => {
    unmount();
    unmount = () => {};
  });

  it.each(WRITES)(
    "lands a %s in each range by what it holds, sending the cached version",
    async (write) => {
      mount({ success: true });
      act(() => writes[write]());
      await settle();

      expectLanded(write);
      expect(sent).toHaveBeenCalledWith(
        `${write}Item`,
        expect.objectContaining({ itemId: "item-0", version: 2 })
      );
    }
  );

  it.each(WRITES)("rolls both ranges back when a %s fails", async (write) => {
    mount(new Error("refused"));
    act(() => writes[write]());
    await settle();

    expect(itemsIn(THIS_WEEK)).toEqual(WEEK_ITEMS);
    expect(itemsIn(CALENDAR_PAGE)).toEqual(PAGE_ITEMS);
  });

  it.each(WRITES)("keeps a Queued %s in both ranges", async (write) => {
    // Backend unreachable: the write sits in the Outbox (ADR-0009).
    mount(new TypeError("Failed to fetch"));
    act(() => writes[write]());
    await settle();

    expectLanded(write);
  });

  it("keeps a Queued move past every range, so growing to its day starts with it", async () => {
    const GROWN = { startISO: CALENDAR_PAGE.startISO, endISO: "2026-10-23" };
    let calendarData: Record<string, PlannedItemFromQuery[]> = {};

    mount(new TypeError("Failed to fetch"));
    act(() => mutations.moveItem("item-0", "2026-10-20", "Lunch", 0));
    await settle();

    const view = renderHookWithClient(queryClient, () => {
      calendarData = useCalendarQuery(GROWN).calendarData;
    });

    expect(calendarData["2026-10-20"]).toEqual([
      expect.objectContaining({ id: "item-0", date: "2026-10-20", slot: "Lunch" }),
    ]);
    view.unmount();
  });

  it.each(WRITES)("sends the newest cached copy's version with a %s", async (write) => {
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
        // Placed one version up, as the server writes it.
        expect.objectContaining({ id: "item-0", title: "Newer", version: 3 }),
      ]);
    }
  });

  it("rereads both ranges after rolling back a failed delete", async () => {
    mount(new Error("refused"));
    act(() => writes.delete());
    await settle();

    expect(itemsIn(THIS_WEEK)).toEqual(WEEK_ITEMS);
    expect(itemsIn(CALENDAR_PAGE)).toEqual(PAGE_ITEMS);
    for (const range of [THIS_WEEK, CALENDAR_PAGE]) {
      expect(queryClient.getQueryState(rangeKey(range.startISO, range.endISO))?.isInvalidated).toBe(
        true
      );
    }
  });

  it("lands a write in a range whose read is in flight, and in a hydrated range", async () => {
    const other = new QueryClient();
    const LATER = { startISO: "2026-09-20", endISO: "2026-09-30" };

    other.setQueryData(rangeKeyOf(LATER), WEEK_ITEMS);
    hydrate(queryClient, dehydrate(other));
    void queryClient.fetchQuery({
      queryKey: rangeKeyOf(THIS_WEEK),
      queryFn: () => new Promise(() => {}),
    });
    mount({ success: true });
    act(() => writes.delete());
    await settle();

    expect(itemsIn(THIS_WEEK)).toEqual(landed.delete.week);
    expect(itemsIn(LATER)).toEqual(landed.delete.week);
  });

  it("creates no data for a range whose read has none yet", async () => {
    const UNREAD = { startISO: "2026-09-20", endISO: "2026-09-30" };

    void queryClient.prefetchQuery({
      queryKey: rangeKeyOf(UNREAD),
      queryFn: () => new Promise(() => {}),
    });
    mount({ success: true });
    act(() => writes.delete());
    await settle();

    expect(queryClient.getQueryCache().find({ queryKey: rangeKeyOf(UNREAD) })).toBeDefined();
    expect(itemsIn(UNREAD)).toBeUndefined();
  });

  it("rereads a widened range a delete cancelled during its first read", async () => {
    const WIDER = { startISO: "2026-08-26", endISO: CALENDAR_PAGE.endISO };
    const server = [cachedItem({ id: "item-aug", date: "2026-08-28" }), ...PAGE_ITEMS.slice(1)];
    let items: PlannedItemFromQuery[] = [];

    // The first read hangs until the delete cancels it; the next one answers.
    readRange.mockImplementationOnce(() => new Promise(() => {}));
    readRange.mockResolvedValue(server);
    mount({ success: true });
    const view = renderHookWithClient(queryClient, () => {
      items = Object.values(useCalendarQuery(WIDER).calendarData).flat();
    });

    expect(queryClient.getQueryState(rangeKeyOf(WIDER))?.fetchStatus).toBe("fetching");
    act(() => writes.delete());
    await settle();

    await act(async () => {
      await vi.waitFor(() => expect(items).toEqual(server));
    });
    view.unmount();
  });

  it("rereads every range once two overlapping writes settle, the first failing", async () => {
    const failing = deferred<never>();
    const landing = deferred<{ success: true }>();
    let server = PAGE_ITEMS;
    let items: PlannedItemFromQuery[] = [];

    queryClient.setMutationDefaults([["calendar", "deleteItem"]], {
      mutationFn: () => failing.promise,
    });
    queryClient.setMutationDefaults([["calendar", "updateItem"]], {
      mutationFn: () => landing.promise,
    });
    readRange.mockImplementation(async () => server);
    ({ unmount } = renderHookWithClient(queryClient, () => {
      mutations = useCalendarMutations();
      items = Object.values(useCalendarQuery(CALENDAR_PAGE).calendarData).flat();
    }));
    await act(async () => {
      await vi.waitFor(() =>
        expect(queryClient.getQueryState(rangeKeyOf(CALENDAR_PAGE))?.fetchStatus).toBe("idle")
      );
    });

    act(() => {
      mutations.deleteItem("item-0");
      mutations.updateItem("item-2", "Leftovers");
    });
    await act(async () => {
      failing.reject(new Error("refused"));
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(1));
    });
    // The server applies the update only now, after the delete failed.
    server = PAGE_ITEMS.map((item) =>
      item.id === "item-2" ? { ...item, title: "Leftovers" } : item
    );
    await act(async () => {
      landing.resolve({ success: true });
    });
    await settle();

    await act(async () => {
      await vi.waitFor(() => expect(items).toEqual(server));
    });
    expect(queryClient.getQueryState(rangeKeyOf(THIS_WEEK))?.isInvalidated).toBe(true);
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

    expectLanded("update");
    for (const range of [THIS_WEEK, CALENDAR_PAGE]) {
      expect(queryClient.getQueryState(rangeKey(range.startISO, range.endISO))?.isInvalidated).toBe(
        true
      );
    }
  });
  // Mutations ride a non-streaming batch link, so an answer can land after a newer echo.
  it.each(["move", "update"] as const)(
    "keeps a newer echo in every range when a %s's answer lands after it",
    async (write) => {
      const answer = deferred<object>();
      const answered = {
        move: payload({ id: "item-0", date: "2026-10-05", slot: "Lunch", version: 2 }),
        update: payload({ id: "item-0", date: "2026-09-22", title: "Leftovers", version: 2 }),
      };

      queryClient.setMutationDefaults([["calendar", `${write}Item`]], {
        mutationFn: () => answer.promise,
      });
      useSubscriptionMock.mockReset();
      ({ unmount } = renderHookWithClient(queryClient, () => {
        mutations = useCalendarMutations();
        useCalendarSubscription();
      }));
      const onUpdated = useSubscriptionMock.mock.calls.find(
        ([options]) => (options as { name: string }).name === "onItemUpdated"
      )![0] as { onData: (data: unknown) => void };
      const newest = payload({ id: "item-0", date: "2026-09-22", title: "Newest", version: 3 });

      act(() => writes[write]());
      act(() => onUpdated.onData(trackedEvent({ item: newest })));
      await act(async () => answer.resolve({ success: true, item: answered[write] }));
      await settle();

      for (const range of [THIS_WEEK, CALENDAR_PAGE]) {
        expect(itemsIn(range)?.find((item) => item.id === "item-0")).toEqual(
          expect.objectContaining({ title: "Newest", version: 3 })
        );
      }
    }
  );

  it("takes the incoming item when the cached copy has the same version", () => {
    const placed = upsertItemInRange(
      [cachedItem({ id: "item-0", title: "Cached", version: 2 })],
      payload({ id: "item-0", date: "2026-09-22", title: "Incoming", version: 2 }),
      THIS_WEEK
    );

    expect(placed).toEqual([expect.objectContaining({ title: "Incoming", version: 2 })]);
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
      items = Object.values(useCalendarQuery(WIDER).calendarData).flat();
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
