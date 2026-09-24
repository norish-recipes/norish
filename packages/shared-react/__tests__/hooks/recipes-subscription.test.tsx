/**
 * The dashboard recipes subscription: what each event does to the caches.
 * Ported from the web wrapper's test when the wrapper went (ticket 07).
 */

import { act } from "react";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO, RecipeDashboardDTO } from "@norish/shared/contracts";

import type { CreateRecipeHooksOptions } from "../../src/hooks/recipes/types";
import { createUseRecipesCacheHelpers } from "../../src/hooks/recipes/dashboard/use-recipes-cache";
import { createUseRecipesSubscription } from "../../src/hooks/recipes/dashboard/use-recipes-subscription";
import { trackedEvent } from "../realtime/tracked-event";
import { renderHookWithClient } from "./render-hook";

const useSubscriptionMock = vi.hoisted(() => vi.fn());

vi.mock("@trpc/tanstack-react-query", async () => {
  const actual = await vi.importActual<typeof import("@trpc/tanstack-react-query")>(
    "@trpc/tanstack-react-query"
  );

  return { ...actual, useSubscription: useSubscriptionMock };
});

const LIST_KEY = [["recipes", "list"], { input: {}, type: "infinite" }];
const LIBRARY_KEY = [["library", "list"], { input: {}, type: "infinite" }];
const CALENDAR_KEY = [["calendar", "listItems"]];
const detailKey = (id: string) => [["recipes", "get"], { input: { id }, type: "query" }];

function procedure(name: string) {
  return { subscriptionOptions: (_input: undefined, opts: object) => ({ name, ...opts }) };
}

const useTRPC = (() => ({
  recipes: {
    list: { queryKey: () => [["recipes", "list"], { input: {}, type: "query" }] },
    get: { queryKey: ({ id }: { id: string }) => detailKey(id) },
    getPending: { queryKey: () => [["recipes", "getPending"], { type: "query" }] },
    onCreated: procedure("onCreated"),
    onImportStarted: procedure("onImportStarted"),
    onImported: procedure("onImported"),
    onUpdated: procedure("onUpdated"),
    onDeleted: procedure("onDeleted"),
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
})) as unknown as CreateRecipeHooksOptions["useTRPC"];

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

function emit(name: string, payload: unknown) {
  const options = useSubscriptionMock.mock.calls
    .map((call) => call[0] as { name: string; onData: (data: unknown) => void })
    .find((opts) => opts.name === name);

  if (!options) throw new Error(`No subscription named ${name}`);

  act(() => options.onData(trackedEvent(payload)));
}

let queryClient: QueryClient;
let rendered: ReturnType<typeof renderHookWithClient>;
let invalidateQueries: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
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

  const useRecipesCacheHelpers = createUseRecipesCacheHelpers({ useTRPC });
  const useRecipesSubscription = createUseRecipesSubscription(
    { useTRPC },
    { useRecipesCacheHelpers }
  );

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

  it("invalidates the calendar for an update that is not an enrichment, by its real key", () => {
    emit("onUpdated", { recipe: fullRecipe({ name: "Renamed" }) });

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: CALENDAR_KEY });
  });

  it("removes a deleted recipe from the list and invalidates its detail query", () => {
    emit("onDeleted", { id: "recipe-1" });

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
});
