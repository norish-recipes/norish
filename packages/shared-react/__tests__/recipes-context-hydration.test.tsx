import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SharedRecipesContextValue } from "../src/contexts/recipes/recipes-context";
import { DEFAULT_RECIPE_FILTERS } from "../src/contexts/recipes/filter-contract";
import { createRecipesContext } from "../src/contexts/recipes/recipes-context";

const UNFILTERED = [{ id: "unfiltered-1" }, { id: "unfiltered-2" }] as never[];

const filtersState = {
  filters: DEFAULT_RECIPE_FILTERS,
  isHydrated: true,
};

const useRecipesQuery = vi.fn((_filters: unknown, options?: { enabled?: boolean }) => ({
  // The persisted query cache can answer the default-filters key instantly,
  // so the fake reports loaded unfiltered data even while disabled.
  recipes: UNFILTERED,
  total: UNFILTERED.length,
  isLoading: false,
  isValidating: false,
  error: null,
  queryKey: ["recipes"],
  hasMore: false,
  pendingRecipeIds: new Set<string>(),
  loadMore: vi.fn(),
  addPendingRecipe: vi.fn(),
  removePendingRecipe: vi.fn(),
  setRecipesData: vi.fn(),
  setAllRecipesData: vi.fn(),
  invalidate: vi.fn(),
  enabled: options?.enabled,
}));

const context = createRecipesContext({
  useRecipesFiltersContext: () => ({
    filters: filtersState.filters,
    clearFilters: vi.fn(),
    isHydrated: filtersState.isHydrated,
  }),
  useRecipesQuery: useRecipesQuery as never,
  useRecipesMutations: () => ({
    importRecipe: vi.fn(),
    importRecipeWithAI: vi.fn(),
    createRecipe: vi.fn(),
    updateRecipe: vi.fn(),
    deleteRecipe: vi.fn(),
  }),
  useFavoritesQuery: () => ({ favoriteIds: [], isFavorite: () => false, isLoading: false }),
  useFavoritesMutation: () => ({ toggleFavorite: vi.fn() }),
  useUserAllergiesQuery: () => ({ allergies: [] }),
  useRecipesSubscription: () => {},
  useToastAdapter: () => ({ show: vi.fn(), translate: () => "" }),
  useNavigationAdapter: () => ({ toHome: vi.fn(), toRecipe: vi.fn() }),
});

let latest!: SharedRecipesContextValue;

function Probe() {
  latest = context.useRecipesContext();

  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  filtersState.filters = DEFAULT_RECIPE_FILTERS;
  filtersState.isHydrated = true;
  useRecipesQuery.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderProbe() {
  act(() => {
    root.render(
      <context.RecipesProvider>
        <Probe />
      </context.RecipesProvider>
    );
  });
}

describe("the library never paints unfiltered", () => {
  it("holds the loading presentation until the stored filters are applied", () => {
    filtersState.isHydrated = false;

    renderProbe();

    // The query answered instantly with the unfiltered collection, but the
    // context still reports loading: consumers paint their skeleton, not
    // recipes the reader had filtered away.
    expect(latest.isLoading).toBe(true);
    expect(useRecipesQuery).toHaveBeenLastCalledWith(expect.anything(), { enabled: false });
  });

  it("releases the gate once hydration applies the stored filters", () => {
    filtersState.isHydrated = false;
    renderProbe();

    filtersState.filters = { ...DEFAULT_RECIPE_FILTERS, rawInput: "soup" };
    filtersState.isHydrated = true;
    renderProbe();

    expect(latest.isLoading).toBe(false);
    expect(useRecipesQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "soup" }),
      { enabled: true }
    );
  });

  it("renders straight through when nothing was stored", () => {
    filtersState.isHydrated = true;

    renderProbe();

    expect(latest.isLoading).toBe(false);
    expect(latest.recipes).toEqual(UNFILTERED);
  });
});
