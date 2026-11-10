/**
 * The dashboard recipes subscription: what each event does to the caches.
 * Ported from the web wrapper's test when the wrapper went (ticket 07).
 */

import { act } from "react";
import { QueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO, RecipeDashboardDTO } from "@norish/shared/contracts";
import { CURSOR_MARK, REALTIME_LAGGED } from "@norish/shared/contracts/realtime/envelope";

import { renderHookWithClient } from "../../../__tests__/hooks/render-hook";
import { trackedEvent } from "../../../__tests__/realtime/tracked-event";
import { useRecipesSubscription } from "../use-recipes-subscription";

// A lag resets the subscription it lagged on.
const useSubscriptionMock = vi.hoisted(() =>
  vi.fn((_options: unknown) => ({ reset: () => undefined }))
);

vi.mock("@trpc/tanstack-react-query", async () => {
  const actual = await vi.importActual<typeof import("@trpc/tanstack-react-query")>(
    "@trpc/tanstack-react-query"
  );

  return { ...actual, useSubscription: useSubscriptionMock };
});

const LIST_KEY = [["recipes", "list"], { input: {}, type: "infinite" }];
const LIBRARY_KEY = [["library", "list"], { input: {}, type: "infinite" }];
const CALENDAR_KEY = [["calendar", "listItems"]];
const CATEGORIES_KEY = [["config", "categories"]];
const PENDING_KEY = [["recipes", "getPending"], { type: "query" }];
const detailKey = (id: string) => [["recipes", "get"], { input: { id }, type: "query" }];

function procedure(name: string) {
  return { subscriptionOptions: (_input: undefined, opts: object) => ({ name, ...opts }) };
}

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    recipes: {
      list: { queryKey: () => [["recipes", "list"], { input: {}, type: "query" }] },
      get: { queryKey: ({ id }: { id: string }) => detailKey(id) },
      getPending: { queryKey: () => PENDING_KEY },
      onCreated: procedure("onCreated"),
      onImportStarted: procedure("onImportStarted"),
      onImported: procedure("onImported"),
      onUpdated: procedure("onUpdated"),
      onDeleted: procedure("onDeleted"),
      onDeleteKept: procedure("onDeleteKept"),
      onConverted: procedure("onConverted"),
      onFailed: procedure("onFailed"),
      onRecipeBatchCreated: procedure("onRecipeBatchCreated"),
    },
    library: {
      list: { queryKey: () => [["library", "list"], { input: {}, type: "query" }] },
    },
    calendar: {
      listItems: { queryKey: () => CALENDAR_KEY },
    },
    config: {
      categories: { queryKey: () => CATEGORIES_KEY },
    },
  }),
}));

function dashboardRecipe(overrides: Partial<RecipeDashboardDTO> = {}): RecipeDashboardDTO {
  return {
    id: "recipe-1",
    userId: "user-1",
    name: "Before",
    image: null,
    servings: 2,
    prepMinutes: null,
    cookMinutes: null,
    calories: null,
    categories: [],
    cuisines: [],
    averageRating: null,
    ratingCount: 0,
    version: 1,
    ...overrides,
  } as RecipeDashboardDTO;
}

function fullRecipe(overrides: Partial<FullRecipeDTO> = {}): FullRecipeDTO {
  return {
    ...dashboardRecipe(),
    systemUsed: "metric",
    recipeIngredients: [],
    steps: [],
    images: [],
    videos: [],
    ...overrides,
  } as FullRecipeDTO;
}

type SubscriptionOptions = {
  name: string;
  onData: (data: unknown) => void;
  onError: (err: unknown) => void;
  onStarted?: () => void;
};

function subscription(name: string) {
  const options = useSubscriptionMock.mock.calls
    .map(([options]) => options as SubscriptionOptions)
    .find((opts) => opts.name === name);

  if (!options) throw new Error(`No subscription named ${name}`);

  return options;
}

function emit(name: string, payload: unknown) {
  act(() => subscription(name).onData(trackedEvent(payload)));
}

/** How often the pending imports were reread. */
function pendingRereads() {
  return invalidateQueries.mock.calls.filter(
    ([filters]) => JSON.stringify(filters) === JSON.stringify({ queryKey: PENDING_KEY })
  ).length;
}

let queryClient: QueryClient;
let rendered: ReturnType<typeof renderHookWithClient>;
let invalidateQueries: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(LIST_KEY, {
    pages: [{ recipes: [dashboardRecipe()], total: 1, nextCursor: null }],
    pageParams: [0],
  });
  queryClient.setQueryData(LIBRARY_KEY, {
    pages: [{ items: [{ kind: "recipe", recipe: dashboardRecipe() }], total: 1, nextCursor: null }],
    pageParams: [0],
  });
  queryClient.setQueryData(detailKey("recipe-1"), fullRecipe());
  invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

  rendered = renderHookWithClient(queryClient, () => useRecipesSubscription());
});

afterEach(() => {
  rendered.unmount();
  queryClient.clear();
});

describe("useRecipesSubscription", () => {
  it("subscribes to every dashboard event once", () => {
    const names = useSubscriptionMock.mock.calls.map((call) => (call[0] as { name: string }).name);

    expect(names.sort()).toEqual(
      [
        "onConverted",
        "onCreated",
        "onDeleted",
        "onDeleteKept",
        "onFailed",
        "onImportStarted",
        "onImported",
        "onRecipeBatchCreated",
        "onUpdated",
      ].sort()
    );
  });

  it("writes an enrichment update straight into the recipe caches without invalidating", () => {
    const updated = fullRecipe({ name: "After enrichment", calories: 420, categories: ["Dinner"] });

    emit("onUpdated", { recipe: updated, source: "enrichment" });

    expect(queryClient.getQueryData(detailKey("recipe-1"))).toEqual(updated);
    expect(queryClient.getQueryData(LIST_KEY)).toEqual(
      expect.objectContaining({
        pages: [
          expect.objectContaining({
            recipes: [
              expect.objectContaining({
                id: "recipe-1",
                name: "After enrichment",
                calories: 420,
                categories: ["Dinner"],
              }),
            ],
          }),
        ],
      })
    );
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("invalidates the calendar and Categories for an update that is not an enrichment", () => {
    emit("onUpdated", { recipe: fullRecipe({ name: "Renamed" }) });

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: CALENDAR_KEY });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: CATEGORIES_KEY });
  });

  it.each(["onCreated", "onDeleted"])(
    "rereads the household's Categories once a saved recipe is announced by %s",
    (name) => {
      emit(name, name === "onCreated" ? { recipe: dashboardRecipe({ id: "r2" }) } : { ids: [] });

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: CATEGORIES_KEY });
    }
  );

  it("removes a deleted recipe from the list and invalidates its detail query", () => {
    emit("onDeleted", { ids: ["recipe-1"] });

    expect(queryClient.getQueryData(LIST_KEY)).toEqual(
      expect.objectContaining({ pages: [expect.objectContaining({ recipes: [], total: 0 })] })
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: detailKey("recipe-1") });
  });

  it("prepends a created recipe once, however often it is announced", () => {
    const created = dashboardRecipe({ id: "recipe-2", name: "New" });

    emit("onCreated", { recipe: created });
    emit("onCreated", { recipe: created });

    const list = queryClient.getQueryData<{ pages: { recipes: RecipeDashboardDTO[] }[] }>(LIST_KEY);

    expect(list?.pages[0]?.recipes.map((r) => r.id)).toEqual(["recipe-2", "recipe-1"]);
  });

  it.each([
    ["onImported", "onFailed"],
    ["onFailed", "onImported"],
  ])(
    "rereads the pending imports once, when %s and then %s are live, for an import that ended before",
    (first, second) => {
      act(() => subscription(first).onStarted?.());
      expect(pendingRereads()).toBe(0);

      act(() => subscription(second).onStarted?.());
      expect(pendingRereads()).toBe(1);

      // A reconnect starts both again: one more reread, not two.
      act(() => subscription(first).onStarted?.());
      act(() => subscription(second).onStarted?.());
      expect(pendingRereads()).toBe(2);
    }
  );

  it.each(["onImported", "onFailed"])(
    "rereads the pending imports and the lists when %s alone lags, once it is live again",
    (name) => {
      act(() => subscription("onImported").onStarted?.());
      act(() => subscription("onFailed").onStarted?.());
      expect(pendingRereads()).toBe(1);

      // The lag restarts this subscription alone, and catches up once its Cursor Mark arrives.
      act(() => subscription(name).onError(new TRPCClientError(REALTIME_LAGGED)));
      act(() => subscription(name).onStarted?.());
      expect(pendingRereads()).toBe(1);

      act(() => subscription(name).onData({ id: "1.abcdef01.1700000000000-0", data: CURSOR_MARK }));
      expect(pendingRereads()).toBe(2);
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: [["recipes", "list"]] });
    }
  );
});
