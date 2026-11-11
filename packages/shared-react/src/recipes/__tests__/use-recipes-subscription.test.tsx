/**
 * The recipe list events and the import and delete outcomes: what each event does to the caches.
 * Ported from the web wrapper's test when the wrapper went (ticket 07).
 */

import { act } from "react";
import { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO, RecipeDashboardDTO } from "@norish/shared/contracts";
import { createTestWrapper, fakePlatformAdapter } from "@norish/shared-react/platform/testing";
import { CURSOR_MARK, REALTIME_LAGGED } from "@norish/shared/contracts/realtime/envelope";
import {
  NOT_A_RECIPE_REASON,
  PRIVATE_ADDRESS_REASON,
} from "@norish/shared/contracts/realtime/recipes";

import { trackedEvent } from "../../../__tests__/realtime/tracked-event";
import { useRecipeSelection } from "../selection-store";
import {
  useRecipeListSubscription,
  useRecipeOutcomesSubscription,
} from "../use-recipes-subscription";

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
const CATEGORIES_KEY = [["config", "categories"]];
const PENDING_KEY = [["recipes", "getPending"], { type: "query" }];
const detailKey = (id: string) => [["recipes", "get"], { input: { id }, type: "query" }];

function procedure(name: string) {
  return {
    subscriptionOptions: (_input: undefined, opts: object) => ({
      name,
      ...opts,
      subscribe: () => ({ unsubscribe: () => undefined }),
    }),
  };
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
  subscribe: (observer: object) => unknown;
};

function subscription(name: string) {
  const options = useSubscriptionMock.mock.calls
    .map(([options]) => options as SubscriptionOptions)
    .find((opts) => opts.name === name);

  if (!options) throw new Error(`No subscription named ${name}`);

  return options;
}

/** A fresh subscribe, then its Cursor Mark: what `useSubscription` and the server do. */
function goLive(name: string) {
  vi.useFakeTimers();
  try {
    act(() => {
      subscription(name).subscribe({});
      subscription(name).onData({ id: "1.abcdef01.1700000000000-0", data: CURSOR_MARK });
    });
    // The catch-up waits out a short window for marks arriving with it.
    act(() => {
      vi.runOnlyPendingTimers();
    });
  } finally {
    vi.useRealTimers();
  }
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
let rendered: ReturnType<typeof renderHook>;
let invalidateQueries: ReturnType<typeof vi.spyOn>;
let platform: ReturnType<typeof fakePlatformAdapter>;

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

  platform = fakePlatformAdapter();
  rendered = renderHook(
    () => {
      useRecipeListSubscription();
      useRecipeOutcomesSubscription();
    },
    { wrapper: createTestWrapper(queryClient, platform) }
  );
});

afterEach(() => {
  rendered.unmount();
  queryClient.clear();
});

describe("the recipe list events and recipe outcomes", () => {
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

  it("rereads only the Categories for an update that is not an enrichment", () => {
    const calendarKey = [
      ["calendar", "listItems"],
      { input: { startISO: "2026-01-01", endISO: "2026-01-07" }, type: "query" },
    ];

    queryClient.setQueryData(CATEGORIES_KEY, { categories: [], builtInAliases: {} });
    queryClient.setQueryData(calendarKey, []);
    emit("onUpdated", { recipe: fullRecipe({ name: "Renamed" }) });

    expect(queryClient.getQueryState(CATEGORIES_KEY)?.isInvalidated).toBe(true);
    // The calendar listens for renames itself.
    expect(queryClient.getQueryState(calendarKey)?.isInvalidated).toBe(false);
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

  it("rereads the recipes a delete kept and announces them once, from the outcomes", () => {
    emit("onDeleteKept", { ids: ["recipe-1"] });

    expect(queryClient.getQueryState(detailKey("recipe-1"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(LIBRARY_KEY)?.isInvalidated).toBe(true);
    expect(platform.toast.show).toHaveBeenCalledTimes(1);
    expect(platform.toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "warning", title: "recipes.toasts.deleteKept" })
    );
  });

  it("drops a deleted recipe from the selection and keeps the rest", () => {
    const selection = useRecipeSelection.getState();

    selection.clear();
    selection.toggle({ id: "recipe-1", version: 1, userId: "user-1" });
    selection.toggle({ id: "recipe-2", version: 1, userId: "user-1" });

    emit("onDeleted", { ids: ["recipe-1"] });

    expect([...useRecipeSelection.getState().selected.keys()]).toEqual(["recipe-2"]);
    selection.clear();
  });

  it("prepends a created recipe once, however often it is announced", () => {
    const created = dashboardRecipe({ id: "recipe-2", name: "New" });

    emit("onCreated", { recipe: created });
    emit("onCreated", { recipe: created });

    const list = queryClient.getQueryData<{ pages: { recipes: RecipeDashboardDTO[] }[] }>(LIST_KEY);

    expect(list?.pages[0]?.recipes.map((r) => r.id)).toEqual(["recipe-2", "recipe-1"]);
  });

  it.each(["onImported", "onFailed"])(
    "rereads the pending imports and the lists once %s is live, for an import that ended before",
    (name) => {
      goLive(name);
      expect(pendingRereads()).toBe(1);
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: [["recipes", "list"]] });

      // A reconnect's mark resumes the same subscribe: nothing to reread.
      vi.useFakeTimers();
      act(() => subscription(name).onData({ id: "1.abcdef01.1700000000000-0", data: CURSOR_MARK }));
      act(() => {
        vi.runOnlyPendingTimers();
      });
      vi.useRealTimers();
      expect(pendingRereads()).toBe(1);
    }
  );

  it.each(["onImported", "onFailed"])(
    "rereads the pending imports and the lists when %s lags, once it is live again",
    (name) => {
      goLive("onImported");
      goLive("onFailed");
      expect(pendingRereads()).toBe(2);

      // The lag restarts this subscription alone, and catches up once its Cursor Mark arrives.
      act(() => subscription(name).onError(new TRPCClientError(REALTIME_LAGGED)));
      expect(pendingRereads()).toBe(2);

      goLive(name);
      expect(pendingRereads()).toBe(3);
    }
  );

  it("warns that an import may be incomplete, and offers to open it", () => {
    emit("onImported", { recipe: dashboardRecipe({ id: "recipe-2" }), incomplete: true });

    expect(platform.toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "warning",
        title: "recipes.toasts.imported",
        description: "recipes.toasts.incomplete",
        actionLabel: "recipes.toasts.view",
      })
    );
    vi.mocked(platform.toast.show).mock.calls[0]![0].onActionPress?.();
    expect(platform.navigation.toRecipe).toHaveBeenCalledWith("recipe-2");
  });

  it("confirms a complete import without a warning", () => {
    emit("onImported", { recipe: dashboardRecipe({ id: "recipe-2" }) });

    expect(platform.toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "success", description: undefined })
    );
  });

  it("names a page that is not a recipe, and keeps other reasons out of the toast", () => {
    emit("onFailed", { reason: NOT_A_RECIPE_REASON });
    emit("onFailed", { reason: PRIVATE_ADDRESS_REASON });
    emit("onFailed", { reason: "Python parser failed: WebsiteNotImplementedError" });

    expect(
      vi
        .mocked(platform.toast.show)
        .mock.calls.map(([toast]) => [toast.severity, toast.description])
    ).toEqual([
      ["danger", "recipes.toasts.notARecipe"],
      ["danger", "recipes.toasts.privateAddress"],
      ["danger", "recipes.toasts.failedDescription"],
    ]);
  });
});
