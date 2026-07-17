import type { Query, QueryKey } from "@tanstack/react-query";
import { createOfflineReadCacheRegistry } from "@/lib/offline-read-cache/query-registry";

function key(path: string[], input?: unknown, type = "query"): QueryKey {
  return [path, input === undefined ? { type } : { input, type }];
}

function query(
  queryKey: QueryKey,
  data: unknown,
  status: "success" | "error" = "success",
  meta?: Record<string, unknown>
) {
  return {
    queryKey,
    meta,
    state: { status, data, dataUpdatedAt: 123 },
  } as unknown as Query;
}

function createRegistry() {
  return createOfflineReadCacheRegistry({
    recipes: {
      list: {
        infiniteQueryOptions: (input) => ({
          queryKey: key(["recipes", "list"], input, "infinite"),
        }),
      },
      get: { queryKey: (input) => key(["recipes", "get"], input) },
    },
    calendar: {
      listItems: { queryKey: (input) => key(["calendar", "listItems"], input) },
    },
    groceries: { list: { queryKey: () => key(["groceries", "list"]) } },
    stores: { list: { queryKey: () => key(["stores", "list"]) } },
    households: { get: { queryKey: () => key(["households", "get"]) } },
  });
}

describe("offline read-cache query registry", () => {
  it("accepts only the exact default recipe dashboard and stores its first 100 summaries", () => {
    const registry = createRegistry();
    const recipes = Array.from({ length: 120 }, (_, index) => ({ id: `recipe-${index}` }));
    const descriptor = registry.describe(
      query(registry.dashboardQueryKey, {
        pages: [{ recipes, total: 120, nextCursor: 100 }, { recipes: [{ id: "page-two" }] }],
        pageParams: [null, 100],
      })
    );

    expect(descriptor).toMatchObject({
      kind: "recipe-dashboard",
      counts: { recipeSummaries: 100 },
    });
    expect(
      (descriptor?.data as { pages: Array<{ recipes: unknown[]; nextCursor: unknown }> }).pages
    ).toEqual([expect.objectContaining({ recipes: recipes.slice(0, 100), nextCursor: null })]);

    expect(registry.dashboardQueryKey).toEqual(
      key(
        ["recipes", "list"],
        {
          limit: 100,
          search: undefined,
          searchFields: ["title", "ingredients"],
          tags: undefined,
          categories: undefined,
          filterMode: "AND",
          sortMode: "dateDesc",
          minRating: undefined,
          maxCookingTime: undefined,
        },
        "infinite"
      )
    );

    const filteredKey = key(
      ["recipes", "list"],
      { limit: 100, search: "private filter", filterMode: "OR", sortMode: "dateDesc" },
      "infinite"
    );

    expect(registry.describe(query(filteredKey, { pages: [{ recipes: [] }] }))).toBeNull();
  });

  it("recognizes complete detail, calendar, grocery, and store contracts", () => {
    const registry = createRegistry();

    expect(
      registry.describe(query(key(["recipes", "get"], { id: "recipe" }), { id: "recipe" }))
    ).toMatchObject({ kind: "recipe-detail", counts: { recipeDetails: 1 } });
    expect(
      registry.describe(
        query(
          key(["calendar", "listItems"], { startISO: "a", endISO: "b" }),
          [{ id: "one" }, { id: "two" }],
          "success",
          { persistOfflineReadCache: true }
        )
      )
    ).toMatchObject({ kind: "calendar-range", counts: { calendarItems: 2 } });
    expect(
      registry.describe(
        query(registry.groceriesQueryKey, {
          groceries: [{ id: "grocery" }],
          recurringGroceries: [{ id: "recurring" }],
          recipeMap: { ingredient: { recipeName: "Soup" } },
        })
      )
    ).toMatchObject({
      kind: "groceries",
      counts: { groceries: 1, recurringGroceries: 1, recipeNameMappings: 1 },
    });
    expect(registry.describe(query(registry.storesQueryKey, [{ id: "store" }]))).toMatchObject({
      kind: "stores",
      counts: { stores: 1 },
    });
  });

  it("accepts calendar ranges only when requested by the calendar screen", () => {
    const registry = createRegistry();
    const calendarKey = key(["calendar", "listItems"], {
      startISO: "2026-07-01",
      endISO: "2026-07-31",
    });

    expect(registry.describe(query(calendarKey, []))).toBeNull();
    expect(
      registry.describe(query(calendarKey, [], "success", { persistOfflineReadCache: true }))
    ).toMatchObject({ kind: "calendar-range" });
  });

  it("rejects errors, partial payloads, admin, auth, and public/share queries", () => {
    const registry = createRegistry();

    expect(registry.describe(query(registry.groceriesQueryKey, { groceries: [] }))).toBeNull();
    expect(registry.describe(query(registry.storesQueryKey, [], "error"))).toBeNull();
    expect(registry.describe(query(key(["admin", "users"]), []))).toBeNull();
    expect(registry.describe(query(key(["auth", "session"]), {}))).toBeNull();
    expect(registry.describe(query(key(["recipes", "getShared"], { token: "x" }), {}))).toBeNull();
  });

  it("uses the real household identity only for scope confirmation", () => {
    const registry = createRegistry();

    expect(registry.isHouseholdQuery(registry.householdQueryKey)).toBe(true);
    expect(registry.isHouseholdQuery(key(["households", "members"]))).toBe(false);
  });
});
