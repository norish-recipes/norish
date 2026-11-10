import { RECIPE_FILTERS_COOKIE, recipeFiltersFromCookie } from "@/lib/recipe-filters-cookie";
import { readStoredRecipeFilters } from "@/lib/recipe-filters-storage";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// The root keeps the document's last filters in module state: each test starts a fresh document.
let LibraryRoot: typeof import("@/features/library/library-root").LibraryRoot;
let useLibraryFilters: typeof import("@norish/shared-react/recipes").useLibraryFilters;

beforeEach(async () => {
  vi.resetModules();
  ({ LibraryRoot } = await import("@/features/library/library-root"));
  ({ useLibraryFilters } = await import("@norish/shared-react/recipes"));
});

let sortByTitle: () => void = () => {};
let searchSoup: () => void = () => {};
/** What every render drew: sort, search text, and whether the loading gate is released. */
let frames: string[] = [];

function Probe() {
  const sortMode = useLibraryFilters((state) => state.filters.sortMode);
  const rawInput = useLibraryFilters((state) => state.filters.rawInput);
  const hydrated = useLibraryFilters((state) => state.hydrated);
  const setFilters = useLibraryFilters((state) => state.setFilters);

  sortByTitle = () => setFilters({ sortMode: "titleAsc" });
  searchSoup = () => setFilters({ rawInput: "soup" });
  frames.push(`${sortMode} ${rawInput || "-"} ${hydrated ? "ready" : "waiting"}`);

  return <p>{sortMode}</p>;
}

afterEach(() => {
  frames = [];
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

  it("releases the loading gate with no cookie and nothing stored", () => {
    render(
      <LibraryRoot filters={undefined}>
        <Probe />
      </LibraryRoot>
    );

    expect(frames.at(-1)).toBe("dateDesc - ready");
  });

  it("keeps the search text and filters when it unmounts and mounts again", () => {
    const { unmount } = render(
      <LibraryRoot filters={undefined}>
        <Probe />
      </LibraryRoot>
    );

    act(() => {
      sortByTitle();
      searchSoup();
    });
    unmount();
    frames = [];
    // The router's cached layout still carries the cookie from the first render.
    render(
      <LibraryRoot filters={DEFAULT_PERSISTED_RECIPE_FILTERS}>
        <Probe />
      </LibraryRoot>
    );

    expect(new Set(frames)).toEqual(new Set(["titleAsc soup ready"]));
  });
});
