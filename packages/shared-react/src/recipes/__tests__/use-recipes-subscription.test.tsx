/**
 * The recipe list events and the import and delete outcomes: what each event does to the caches.
 * Ported from the web wrapper's test when the wrapper went (ticket 07).
 */

import { act } from "react";
import { matchQuery, QueryClient, QueryObserver } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO, RecipeDashboardDTO } from "@norish/shared/contracts";
import { createTestWrapper, fakePlatformAdapter } from "@norish/shared-react/platform/testing";
import { REALTIME_LAGGED } from "@norish/shared/contracts/realtime/envelope";
import {
  NO_RECIPE_FOUND_REASON,
  NOT_A_RECIPE_REASON,
  PRIVATE_ADDRESS_REASON,
} from "@norish/shared/contracts/realtime/recipes";

import { trackedCursorMark, trackedEvent } from "../../../__tests__/realtime/tracked-event";
import { LIVE_WINDOW_MS } from "../../realtime/use-realtime-subscription";
import { useRecipeSelection } from "../selection-store";
import { useRecipesCacheHelpers } from "../use-recipes-cache";
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
const DISCOVER_KEY = [["library", "discover"], { type: "query" }];
const PENDING_KEY = [["recipes", "getPending"], { type: "query" }];
const detailKey = (id: string) => [["recipes", "get"], { input: { id }, type: "query" }];

function procedure(name: string) {
  return {
    subscriptionOptions: (_input: undefined, opts: object) => ({
      name,
      queryKey: [["recipes", name], { type: "any" }],
      ...opts,
      subscribe: () => ({ unsubscribe: () => undefined }),
    }),
  };
}

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    recipes: {
      list: {
        pathKey: () => [["recipes", "list"]],
        queryKey: () => [["recipes", "list"], { input: {}, type: "query" }],
      },
      get: {
        pathKey: () => [["recipes", "get"]],
        queryKey: ({ id }: { id: string }) => detailKey(id),
      },
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
      pathKey: () => [["library"]],
      discover: { pathKey: () => [["library", "discover"]] },
      list: {
        pathKey: () => [["library", "list"]],
        queryKey: () => [["library", "list"], { input: {}, type: "query" }],
      },
    },
    cookbooks: { recipes: { pathKey: () => [["cookbooks", "recipes"]] } },
    config: {
      categories: { queryKey: () => CATEGORIES_KEY },
      tags: { queryKey: () => [["config", "tags"]] },
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

/** A fresh subscribe, as `useSubscription` opens one. */
function subscribe(name: string) {
  act(() => {
    subscription(name).subscribe({});
  });
}

/** The server's Cursor Mark, then the short window the reread waits out for marks arriving with it. */
function markLive(name: string) {
  act(() => subscription(name).onData(trackedCursorMark()));
  act(() => {
    vi.runOnlyPendingTimers();
  });
}

function emit(name: string, payload: unknown) {
  act(() => subscription(name).onData(trackedEvent(payload)));
}

/** How often a cached read was invalidated, by key or by predicate. */
function rereadsOf(queryKey: unknown[]) {
  const query = queryClient.getQueryCache().find({ queryKey, exact: true });

  if (!query) throw new Error(`Nothing cached at ${JSON.stringify(queryKey)}`);

  return invalidateQueries.mock.calls.filter(([filters]) => matchQuery(filters ?? {}, query))
    .length;
}

const pendingRereads = () => rereadsOf(PENDING_KEY);

/** Lets the rereads asked for in one burst be made. */
function endBurst() {
  act(() => {
    vi.advanceTimersByTime(LIVE_WINDOW_MS);
  });
}

let queryClient: QueryClient;
let rendered: ReturnType<typeof renderHook<ReturnType<typeof useRecipesCacheHelpers>, unknown>>;
let invalidateQueries: ReturnType<typeof vi.spyOn>;
let platform: ReturnType<typeof fakePlatformAdapter>;

beforeEach(() => {
  vi.useFakeTimers();
  // No garbage collection: the reread's window runs every pending timer, the cache's too.
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  queryClient.setQueryData(LIST_KEY, {
    pages: [{ recipes: [dashboardRecipe()], total: 1, nextCursor: null }],
    pageParams: [0],
  });
  queryClient.setQueryData(LIBRARY_KEY, {
    pages: [{ items: [{ kind: "recipe", recipe: dashboardRecipe() }], total: 1, nextCursor: null }],
    pageParams: [0],
  });
  queryClient.setQueryData(detailKey("recipe-1"), fullRecipe());
  queryClient.setQueryData(PENDING_KEY, []);
  queryClient.setQueryData(CATEGORIES_KEY, { categories: [], builtInAliases: {} });
  queryClient.setQueryData(DISCOVER_KEY, { categories: [], tags: [] });
  invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

  platform = fakePlatformAdapter();
  rendered = renderHook(
    () => {
      useRecipeListSubscription();
      useRecipeOutcomesSubscription();

      return useRecipesCacheHelpers();
    },
    { wrapper: createTestWrapper(queryClient, platform) }
  );
});

afterEach(() => {
  rendered.unmount();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
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

  it("keeps the import's link on its pending card, whichever of the placeholder and event comes first", () => {
    queryClient.setQueryData(PENDING_KEY, [{ recipeId: "r-1", url: "", addedAt: 1 }]);

    emit("onImportStarted", { recipeId: "r-1", url: "https://www.seriouseats.com/x" });

    expect(queryClient.getQueryData(PENDING_KEY)).toEqual([
      { recipeId: "r-1", url: "https://www.seriouseats.com/x", addedAt: 1 },
    ]);
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

  it.each(["onUpdated", "onConverted"])(
    "never writes a delayed %s recipe over a newer cached one",
    (name) => {
      const newer = fullRecipe({ name: "Newer", version: 3 });

      queryClient.setQueryData(detailKey("recipe-1"), newer);
      queryClient.setQueryData(LIST_KEY, {
        pages: [
          { recipes: [dashboardRecipe({ name: "Newer", version: 3 })], total: 1, nextCursor: null },
        ],
        pageParams: [0],
      });

      emit(name, {
        recipe: fullRecipe({ name: "Older", version: 2 }),
        conversion: { target: "us", withAI: false, version: 1 },
        stale: false,
      });

      expect(queryClient.getQueryData(detailKey("recipe-1"))).toEqual(newer);
      expect(
        (queryClient.getQueryData(LIST_KEY) as { pages: { recipes: RecipeDashboardDTO[] }[] })
          .pages[0]?.recipes
      ).toEqual([expect.objectContaining({ name: "Newer", version: 3 })]);
    }
  );

  it("shows a photo another member added, once however often it is announced", () => {
    const photo = { id: "image-1", image: "/recipes/recipe-1/a.jpg", order: 0, version: 1 };
    const withPhoto = fullRecipe({ images: [photo] } as Partial<FullRecipeDTO>);

    emit("onUpdated", { recipe: withPhoto });
    emit("onUpdated", { recipe: withPhoto });

    expect(queryClient.getQueryData(detailKey("recipe-1"))).toEqual(withPhoto);
    expect(
      (queryClient.getQueryData(LIST_KEY) as { pages: { recipes: RecipeDashboardDTO[] }[] })
        .pages[0]?.recipes
    ).toEqual([expect.objectContaining({ id: "recipe-1", image: photo.image })]);
  });

  it("keeps the photo a client already has from its own upload, unchanged", () => {
    const photo = { id: "image-1", image: "/recipes/recipe-1/a.jpg", order: 0, version: 1 };
    const withPhoto = fullRecipe({ images: [photo] } as Partial<FullRecipeDTO>);

    queryClient.setQueryData(detailKey("recipe-1"), withPhoto);
    emit("onUpdated", { recipe: fullRecipe({ images: [{ ...photo }] } as Partial<FullRecipeDTO>) });

    expect(queryClient.getQueryData<FullRecipeDTO>(detailKey("recipe-1"))?.images).toEqual([photo]);
  });

  it("rereads only what is built from the recipes for an update that is not an enrichment", () => {
    const calendarKey = [
      ["calendar", "listItems"],
      { input: { startISO: "2026-01-01", endISO: "2026-01-07" }, type: "query" },
    ];

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

  it.each([
    ["onCreated", { recipe: dashboardRecipe({ id: "r2" }) }],
    ["onUpdated", { recipe: fullRecipe({ name: "Renamed" }) }],
    ["onDeleted", { ids: ["recipe-1"] }],
    ["onImported", { recipe: dashboardRecipe({ id: "r2" }) }],
    ["onRecipeBatchCreated", { recipes: [dashboardRecipe({ id: "r2" })] }],
    ["onFailed", {}],
    ["onDeleteKept", { ids: ["recipe-1"] }],
  ])("rereads Search's Categories and Tags once on %s", (name, payload) => {
    emit(name, payload);
    endBurst();

    expect(rereadsOf(DISCOVER_KEY)).toBe(1);
  });

  it.each([
    ["onImported", { recipe: dashboardRecipe({ id: "r2" }) }],
    ["onRecipeBatchCreated", { recipes: [dashboardRecipe({ id: "r2" })] }],
  ])("rereads nothing a web page shows on %s, Discover alone", (name, payload) => {
    emit(name, payload);
    endBurst();

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(rereadsOf(DISCOVER_KEY)).toBe(1);
    expect([rereadsOf(LIST_KEY), rereadsOf(LIBRARY_KEY)]).toEqual([0, 0]);
  });

  it.each(["auto-tagging", "allergy-detection", "auto-categorization", "image-generation"])(
    "rereads Search's Categories and Tags, not the household's, after %s",
    (kind) => {
      emit("onUpdated", { recipe: fullRecipe(), source: "enrichment", kind });
      emit("onUpdated", { recipe: fullRecipe({ id: "recipe-2" }), source: "enrichment", kind });
      endBurst();

      expect(rereadsOf(DISCOVER_KEY)).toBe(1);
      expect(rereadsOf(CATEGORIES_KEY)).toBe(0);
    }
  );

  it.each(["nutrition-estimation", "recipe-provenance", "ingredient-linking"])(
    "rereads nothing after %s, which changes nothing Discover lists",
    (kind) => {
      emit("onUpdated", { recipe: fullRecipe(), source: "enrichment", kind });
      endBurst();

      expect(invalidateQueries).not.toHaveBeenCalled();
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
    endBurst();

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

  it.each(["onImportStarted", "onImported", "onFailed", "onDeleteKept"])(
    "rereads the pending imports, the lists and the details once %s is live, for an import that ended before",
    (name) => {
      subscribe(name);
      markLive(name);
      expect(pendingRereads()).toBe(1);
      expect(rereadsOf(LIST_KEY)).toBe(1);
      expect(rereadsOf(LIBRARY_KEY)).toBe(1);
      expect(rereadsOf(detailKey("recipe-1"))).toBe(1);

      // A reconnect's mark resumes the same subscribe: nothing to reread.
      markLive(name);
      expect(pendingRereads()).toBe(1);
    }
  );

  it.each(["onCreated", "onUpdated", "onDeleted", "onConverted", "onRecipeBatchCreated"])(
    "rereads every read the list events touch, the Categories too, once %s is live",
    (name) => {
      subscribe(name);
      markLive(name);

      for (const key of [LIST_KEY, LIBRARY_KEY, detailKey("recipe-1"), PENDING_KEY]) {
        expect(rereadsOf(key)).toBe(1);
      }
      expect(rereadsOf(CATEGORIES_KEY)).toBe(1);
    }
  );

  it.each(["onImported", "onFailed"])(
    "rereads the pending imports and the lists when %s lags, once it is live again",
    (name) => {
      subscribe("onImported");
      markLive("onImported");
      subscribe("onFailed");
      markLive("onFailed");
      expect(pendingRereads()).toBe(2);

      // The lag restarts this subscription alone, and rereads once its Cursor Mark arrives.
      act(() => subscription(name).onError(new TRPCClientError(REALTIME_LAGGED)));
      expect(pendingRereads()).toBe(2);

      subscribe(name);
      markLive(name);
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

  it("confirms a complete import without a warning, naming the recipe", () => {
    emit("onImported", { recipe: dashboardRecipe({ id: "recipe-2", name: "Pad thai" }) });

    expect(platform.toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "success", description: undefined, subject: "Pad thai" })
    );
  });

  it("names a page that is not a recipe, and keeps other reasons out of the toast", () => {
    emit("onFailed", { reason: NOT_A_RECIPE_REASON });
    emit("onFailed", { reason: NO_RECIPE_FOUND_REASON });
    emit("onFailed", { reason: PRIVATE_ADDRESS_REASON });
    emit("onFailed", { reason: "Python parser failed: WebsiteNotImplementedError" });

    expect(
      vi
        .mocked(platform.toast.show)
        .mock.calls.map(([toast]) => [toast.severity, toast.title, toast.description])
    ).toEqual([
      ["danger", "common.import.paste.failed", "recipes.toasts.notARecipe"],
      ["danger", "common.import.paste.failed", "recipes.toasts.notARecipe"],
      ["danger", "common.import.paste.failed", "recipes.toasts.privateAddress"],
      ["danger", "common.import.paste.failed", "recipes.toasts.failedDescription"],
    ]);
  });
});

describe("Search's own lists", () => {
  const SEARCH_KEY = [
    ["library", "list"],
    {
      input: { search: "soup", sortBeatsRank: true, withMatch: true, type: "recipes" },
      type: "infinite",
    },
  ];
  const SUGGEST_KEY = [
    ["library", "list"],
    { input: { search: "soup", sortBeatsRank: true, limit: 2, type: "recipes" }, type: "infinite" },
  ];
  const held = (id: string) => ({
    kind: "recipe",
    recipe: dashboardRecipe({ id, name: `Soup ${id}` }),
    match: { field: "title" },
  });
  const cached = () => ({
    pages: [{ items: [held("recipe-1"), held("recipe-2")], total: 2, nextCursor: null }],
    pageParams: [0],
  });

  beforeEach(() => {
    queryClient.setQueryData(SEARCH_KEY, cached());
    queryClient.setQueryData(SUGGEST_KEY, cached());
  });

  it.each([
    ["onUpdated", { recipe: fullRecipe({ name: "Renamed" }) }],
    ["onCreated", { recipe: dashboardRecipe({ id: "r3", name: "Cake" }) }],
    ["onImported", { recipe: dashboardRecipe({ id: "r3", name: "Cake" }) }],
    ["onDeleted", { ids: ["recipe-1"] }],
  ])("are never patched by %s, keeping their match lines, and are reread once", (name, payload) => {
    emit(name, payload);
    emit(name, payload);
    endBurst();

    for (const key of [SEARCH_KEY, SUGGEST_KEY]) {
      expect(queryClient.getQueryData(key)).toEqual(cached());
      expect(rereadsOf(key)).toBe(1);
    }
  });

  it("still patches the Library's own list as before", () => {
    emit("onCreated", { recipe: dashboardRecipe({ id: "r3", name: "Cake" }) });

    expect(
      (queryClient.getQueryData(LIBRARY_KEY) as { pages: { items: unknown[] }[] }).pages[0]?.items
    ).toHaveLength(2);
  });
});

describe("the rereads Library and Discover are asked for", () => {
  type Gate = { release: () => void; wait: Promise<void> };
  const open = (): Gate => {
    let release = () => {};
    const wait = new Promise<void>((resolve) => (release = resolve));

    return { release, wait };
  };
  const stops: (() => void)[] = [];

  /** Mounts a real observer on `queryKey`; `requests` counts the fetches that reach its queryFn. */
  function observe(queryKey: unknown[]) {
    const read = { requests: 0, gate: null as Gate | null };
    const observer = new QueryObserver(queryClient, {
      queryKey,
      staleTime: Infinity,
      queryFn: async () => {
        read.requests++;
        await read.gate?.wait;

        return queryClient.getQueryData(queryKey) ?? null;
      },
    });

    stops.push(observer.subscribe(() => undefined));

    return read;
  }

  /** A write in flight: `settle` ends it as a success, or as the failure it is told. */
  function startWrite() {
    const gate = open();
    let fail = false;
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: async () => {
        await gate.wait;
        if (fail) throw new Error("write failed");
      },
    });

    void mutation.execute(undefined).catch(() => undefined);

    return {
      settle: async (failed = false) => {
        fail = failed;
        gate.release();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
      },
    };
  }

  async function elapse(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  /** A delete that also kept some: both events, then the mutation's success. */
  function mixedDelete() {
    emit("onDeleted", { ids: ["recipe-1"] });
    emit("onDeleteKept", { ids: ["recipe-2"] });
    act(() => rendered.result.current.invalidate());
  }

  afterEach(() => stops.splice(0).forEach((stop) => stop()));

  it("makes one request per observed query for a mixed delete", async () => {
    const [library, discover] = [observe(LIBRARY_KEY), observe(DISCOVER_KEY)];

    mixedDelete();
    await elapse(LIVE_WINDOW_MS);

    expect([library.requests, discover.requests]).toEqual([1, 1]);

    await elapse(LIVE_WINDOW_MS * 4);

    expect([library.requests, discover.requests]).toEqual([1, 1]);
  });

  it.each([
    ["succeeds", false],
    ["fails", true],
  ])("waits for a write in flight, and rereads once it %s", async (_label, failed) => {
    const [library, discover] = [observe(LIBRARY_KEY), observe(DISCOVER_KEY)];
    const write = startWrite();

    mixedDelete();
    await elapse(LIVE_WINDOW_MS * 4);

    expect([library.requests, discover.requests]).toEqual([0, 0]);

    await write.settle(failed);
    await elapse(LIVE_WINDOW_MS);

    expect([library.requests, discover.requests]).toEqual([1, 1]);
  });

  it("rereads once after a matching read in flight, never joining it", async () => {
    const library = observe(LIBRARY_KEY);

    library.gate = open();
    void queryClient.refetchQueries({ queryKey: LIBRARY_KEY });
    await elapse(0);
    expect(library.requests).toBe(1);

    mixedDelete();
    await elapse(LIVE_WINDOW_MS * 4);

    expect(library.requests).toBe(1);

    const gate = library.gate;

    library.gate = null;
    gate.release();
    await elapse(LIVE_WINDOW_MS);

    expect(library.requests).toBe(2);
  });
});
