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

import type { CreateCalendarHooksOptions } from "../../src/hooks/calendar/types";
import { calendarRangeOfQueryKey } from "../../src/hooks/calendar/calendar-cache-merge";
import { createUseCalendarCache } from "../../src/hooks/calendar/use-calendar-cache";
import { createUseCalendarMutations } from "../../src/hooks/calendar/use-calendar-mutations";
import { createUseCalendarSubscription } from "../../src/hooks/calendar/use-calendar-subscription";
import { trackedEvent } from "../realtime/tracked-event";
import { renderHookWithClient } from "./render-hook";

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

const useTRPC = (() => ({
  calendar: {
    listItems: {
      queryKey: (input?: { startISO: string; endISO: string }) =>
        input ? rangeKey(input.startISO, input.endISO) : [PATH],
    },
    createItem: {
      mutationOptions: (opts: object) => ({ mutationKey: [["calendar", "createItem"]], ...opts }),
    },
    deleteItem: { mutationOptions: (opts: object) => opts },
    moveItem: { mutationOptions: (opts: object) => opts },
    updateItem: { mutationOptions: (opts: object) => opts },
    onItemCreated: procedure("onItemCreated"),
    onItemDeleted: procedure("onItemDeleted"),
    onItemMoved: procedure("onItemMoved"),
    onItemUpdated: procedure("onItemUpdated"),
    onFailed: procedure("onFailed"),
  },
})) as unknown as CreateCalendarHooksOptions["useTRPC"];

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
    const useCalendarCacheHelpers = createUseCalendarCache({ useTRPC });
    const useCalendarSubscription = createUseCalendarSubscription({
      useTRPC,
      useCalendarCacheHelpers,
    });

    ({ unmount } = renderHookWithClient(queryClient, () =>
      useCalendarSubscription(THIS_WEEK.startISO, THIS_WEEK.endISO)
    ));
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
    const useCalendarCacheHelpers = createUseCalendarCache({ useTRPC });
    const useCalendarMutations = createUseCalendarMutations({ useTRPC, useCalendarCacheHelpers });
    const useCalendarSubscription = createUseCalendarSubscription({
      useTRPC,
      useCalendarCacheHelpers,
    });
    let mutations: ReturnType<typeof useCalendarMutations> | null = null;

    queryClient.setMutationDefaults([["calendar", "createItem"]], {
      mutationFn: async () => ({ id: "item-1", item: payload() }),
    });

    ({ unmount } = renderHookWithClient(queryClient, () => {
      mutations = useCalendarMutations(THIS_WEEK.startISO, THIS_WEEK.endISO);
      useCalendarSubscription(THIS_WEEK.startISO, THIS_WEEK.endISO);
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
