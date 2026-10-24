import type { Root } from "react-dom/client";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PersistedRecipeFilters } from "../src/contexts/recipes/filter-contract";
import { DEFAULT_PERSISTED_RECIPE_FILTERS } from "../src/contexts/recipes/filter-contract";
import { createRecipeFiltersContext } from "../src/contexts/recipes/recipe-filters-context";

const KEY = "filters";

function storageHolding(filters: PersistedRecipeFilters | null) {
  const stored = new Map(filters ? [[KEY, JSON.stringify(filters)]] : []);

  return {
    stored,
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => void stored.set(key, value)),
    removeItem: (key: string) => void stored.delete(key),
  };
}

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
});

/** Every render's sort and readiness, from the first. */
async function renderProvider(
  storage: ReturnType<typeof storageHolding>,
  initialFilters?: PersistedRecipeFilters
) {
  const { RecipeFiltersProvider, useRecipeFiltersContext } = createRecipeFiltersContext({
    storageAdapter: storage,
    storageKey: KEY,
  });
  const renders: { sortMode: string; isHydrated: boolean }[] = [];

  function Probe() {
    const { filters, isHydrated } = useRecipeFiltersContext();

    renders.push({ sortMode: filters.sortMode, isHydrated });

    return null;
  }

  root = createRoot(document.createElement("div"));
  await act(async () =>
    root?.render(
      <RecipeFiltersProvider initialFilters={initialFilters}>
        <Probe />
      </RecipeFiltersProvider>
    )
  );

  return renders;
}

describe("RecipeFiltersProvider", () => {
  it("asks under the server's filters from the first render, without waiting for storage", async () => {
    const storage = storageHolding({ ...DEFAULT_PERSISTED_RECIPE_FILTERS, sortMode: "titleAsc" });
    const renders = await renderProvider(storage, {
      ...DEFAULT_PERSISTED_RECIPE_FILTERS,
      sortMode: "titleAsc",
    });

    expect(renders[0]).toEqual({ sortMode: "titleAsc", isHydrated: true });
    expect(renders.at(-1)).toEqual({ sortMode: "titleAsc", isHydrated: true });
  });

  it("waits for storage without the server's filters", async () => {
    const storage = storageHolding({ ...DEFAULT_PERSISTED_RECIPE_FILTERS, sortMode: "titleAsc" });
    const renders = await renderProvider(storage);

    expect(renders[0]).toEqual({ sortMode: "dateDesc", isHydrated: false });
    expect(renders.at(-1)).toEqual({ sortMode: "titleAsc", isHydrated: true });
  });

  it("takes newer filters from storage over a kept document's, and never writes the old ones back", async () => {
    const storage = storageHolding({ ...DEFAULT_PERSISTED_RECIPE_FILTERS, sortMode: "titleAsc" });
    const renders = await renderProvider(storage, {
      ...DEFAULT_PERSISTED_RECIPE_FILTERS,
      sortMode: "dateAsc",
    });

    expect(renders.at(-1)).toEqual({ sortMode: "titleAsc", isHydrated: true });
    expect(JSON.parse(storage.stored.get(KEY)!)).toMatchObject({ sortMode: "titleAsc" });
    expect(storage.setItem.mock.calls.some(([, value]) => value.includes("dateAsc"))).toBe(false);
  });
});
