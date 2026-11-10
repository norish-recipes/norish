import { LibraryRoot } from "@/features/library/library-root";
import { RECIPE_FILTERS_COOKIE, recipeFiltersFromCookie } from "@/lib/recipe-filters-cookie";
import { readStoredRecipeFilters } from "@/lib/recipe-filters-storage";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLibraryFilters } from "@norish/shared-react/recipes";
import { DEFAULT_PERSISTED_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

vi.mock("@norish/shared-react/recipes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/recipes")>()),
  useLibrarySubscriptions: () => {},
}));

const cookie = () =>
  recipeFiltersFromCookie(
    document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${RECIPE_FILTERS_COOKIE}=`))!
      .slice(RECIPE_FILTERS_COOKIE.length + 1)
  );

let sortByTitle: () => void = () => {};

function Probe() {
  const sortMode = useLibraryFilters((state) => state.filters.sortMode);
  const setFilters = useLibraryFilters((state) => state.setFilters);

  sortByTitle = () => setFilters({ sortMode: "titleAsc" });

  return <p>{sortMode}</p>;
}

afterEach(() => {
  localStorage.clear();
  document.cookie = `${RECIPE_FILTERS_COOKIE}=; max-age=0; path=/`;
});

describe("LibraryRoot", () => {
  it("takes the browser's stored filters over a kept document's cookie, and writes them back", () => {
    localStorage.setItem(
      "norish:recipe-filters",
      JSON.stringify({ ...DEFAULT_PERSISTED_RECIPE_FILTERS, sortMode: "dateAsc" })
    );
    render(
      <LibraryRoot filters={DEFAULT_PERSISTED_RECIPE_FILTERS}>
        <Probe />
      </LibraryRoot>
    );

    expect(screen.getByText("dateAsc")).toBeInTheDocument();
    expect(cookie().sortMode).toBe("dateAsc");
  });

  it("writes every change to the browser's storage and the cookie", () => {
    render(
      <LibraryRoot filters={undefined}>
        <Probe />
      </LibraryRoot>
    );

    act(() => sortByTitle());

    expect(screen.getByText("titleAsc")).toBeInTheDocument();
    expect(readStoredRecipeFilters()?.sortMode).toBe("titleAsc");
    expect(cookie().sortMode).toBe("titleAsc");
  });
});
