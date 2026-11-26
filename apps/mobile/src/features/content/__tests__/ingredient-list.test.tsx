// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "../../../../__tests__/mocks/content-setup";

const held = vi.hoisted(() => ({
  router: { push: vi.fn() },
  query: {} as Record<string, unknown>,
  rows: [] as unknown[],
  toggle: vi.fn(),
  fetchNextPage: vi.fn(),
  retry: vi.fn(),
  filters: {} as object,
  total: undefined as number | undefined,
}));

vi.mock("expo-router", () => ({ useRouter: () => held.router }));
vi.mock("@/components/ingredient-icon", () => ({
  IngredientIcon: () => null,
  IngredientIconSlots: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/search-filter-row", async () => {
  const { createElement } = await import("react");

  return {
    SearchFilterRow: ({
      filter,
      onChange,
    }: {
      filter: { active: boolean; onPress: () => void };
      onChange: (value: string) => void;
    }) =>
      createElement(
        "div",
        null,
        createElement("input", {
          "data-testid": "search",
          onChange: (event: { target: { value: string } }) => onChange(event.target.value),
        }),
        createElement("button", {
          "data-testid": "filter",
          "data-active": filter.active,
          onClick: filter.onPress,
        })
      ),
  };
});
vi.mock("../components/data-sources", () => ({
  DataSources: () => <div data-testid="data-sources" />,
}));
vi.mock("../components/ai-changes-row", () => ({
  AiChangesRow: ({ onPress }: { onPress: () => void }) => (
    <button data-testid="ai-row" onClick={onPress} />
  ),
}));
vi.mock("@norish/shared-react/lists", async (importActual) => ({
  ...(await importActual<object>()),
  useIngredientCount: () => held.total,
}));
vi.mock("@norish/shared-react/config", () => ({ useIngredientsSubscription: () => undefined }));
vi.mock("@norish/shared-react/ingredients", async (importActual) => ({
  ...(await importActual<object>()),
  useIngredientFiltersStore: (select: (state: unknown) => unknown) =>
    select({ filters: held.filters }),
  useIngredientIcons: () => undefined,
  useIngredientList: () => ({
    items: held.rows,
    isLoading: false,
    failed: false,
    retry: held.retry,
    isPaused: false,
    isPlaceholderData: false,
    hasNextPage: false,
    fetchNextPage: held.fetchNextPage,
    treeMode: true,
    tree: { rows: held.rows, toggle: held.toggle },
    ...held.query,
  }),
}));

const { DEFAULT_INGREDIENT_FILTERS } = await import("@norish/shared-react/ingredients");
const { IngredientList } = await import("../components/ingredient-list");

const row = (id: string, over: Record<string, unknown> = {}, depth = 0, expanded = false) => ({
  item: {
    id,
    name: id,
    kinds: 0,
    flagged: false,
    aliases: [],
    parent: null,
    canEdit: true,
    ...over,
  },
  depth,
  expanded,
  loading: false,
});

describe("IngredientList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    held.query = {};
    held.total = undefined;
    held.filters = DEFAULT_INGREDIENT_FILTERS;
    held.rows = [row("Rice", { kinds: 3 }), row("Soy sauce", { flagged: true })];
  });

  it("is a skeleton while the first page loads", () => {
    held.query = { isLoading: true };
    render(<IngredientList />);
    expect(screen.getByTestId("content-skeleton")).toBeTruthy();
  });

  it("lists the foods, flags the flagged, and opens a food's sheet", () => {
    render(<IngredientList />);
    expect(screen.getByTestId("content-ingredient-Soy sauce").textContent).toContain(
      "settings.ingredients.flagged"
    );
    expect(screen.getByTestId("content-ingredient-Rice").textContent).not.toContain("flagged");
    fireEvent.click(screen.getByTestId("content-ingredient-Rice"));
    expect(held.router.push).toHaveBeenCalledWith({
      pathname: "/settings/ingredient",
      params: { id: "Rice" },
    });
  });

  it("closes the list with the data sources", () => {
    render(<IngredientList />);
    expect(screen.getByTestId("data-sources")).toBeTruthy();
  });

  it("heads the list with how many ingredients there are", () => {
    held.total = 1204;
    render(<IngredientList />);
    expect(screen.getByTestId("content-heading").textContent).toBe(
      'settings.content.count.ingredient{"count":1204}'
    );
  });

  it("drops the heading under a filter, which narrows the total", () => {
    held.total = 1204;
    held.filters = { ...DEFAULT_INGREDIENT_FILTERS, flaggedOnly: true };
    render(<IngredientList />);
    expect(screen.queryByTestId("content-heading")).toBeNull();
  });

  it("drops the heading while a search is typed", () => {
    held.total = 1204;
    render(<IngredientList />);
    fireEvent.change(screen.getByTestId("search"), { target: { value: "rice" } });
    expect(screen.queryByTestId("content-heading")).toBeNull();
  });

  it("draws no heading before the count is read", () => {
    render(<IngredientList />);
    expect(screen.queryByTestId("content-heading")).toBeNull();
  });

  it("folds a food's kinds out, only for a food that has some", () => {
    render(<IngredientList />);
    fireEvent.click(screen.getByTestId("content-kinds-Rice"));
    expect(held.toggle).toHaveBeenCalledWith("Rice");
    expect(screen.queryByTestId("content-kinds-Soy sauce")).toBeNull();
  });

  it("says nothing is flagged under the flagged filter, and nothing found otherwise", () => {
    held.rows = [];
    held.filters = { ...DEFAULT_INGREDIENT_FILTERS, flaggedOnly: true };
    const first = render(<IngredientList />);

    expect(screen.getByTestId("content-empty").textContent).toContain("emptyFlagged");
    first.unmount();
    held.filters = DEFAULT_INGREDIENT_FILTERS;
    render(<IngredientList />);
    expect(screen.getByTestId("content-empty").textContent).toContain("settings.ingredients.empty");
  });

  it("marks the filter button while a filter applies, and opens the filters and Changed by AI", () => {
    held.filters = { ...DEFAULT_INGREDIENT_FILTERS, standaloneOnly: true };
    render(<IngredientList />);
    expect(screen.getByTestId("filter").getAttribute("data-active")).toBe("true");
    fireEvent.click(screen.getByTestId("filter"));
    expect(held.router.push).toHaveBeenCalledWith("/settings/ingredient-filters");
    fireEvent.click(screen.getByTestId("ai-row"));
    expect(held.router.push).toHaveBeenCalledWith("/settings/ingredient-changes");
  });

  it("says a failed read, not that there are no ingredients, and Retry reads it again", () => {
    held.rows = [];
    held.query = { failed: true };
    render(<IngredientList />);
    expect(screen.queryByTestId("content-empty")).toBeNull();
    fireEvent.click(screen.getByTestId("content-retry"));
    expect(held.retry).toHaveBeenCalled();
  });
});
