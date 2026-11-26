// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const held = vi.hoisted(() => ({
  router: { push: vi.fn() },
  query: {} as Record<string, unknown>,
  rows: [] as unknown[],
  toggle: vi.fn(),
  fetchNextPage: vi.fn(),
  filters: {} as object,
}));

vi.mock("react-native", async () =>
  (await import("../../../../__tests__/mocks/content-ui")).reactNative(vi.fn())
);
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: () => undefined }));
vi.mock("heroui-native", () => ({ Skeleton: () => null }));
vi.mock("react-intl", () => ({ useIntl: () => ({ locale: "en" }) }));
vi.mock("@/lib/i18n/use-text", async () => ({
  useText: (await import("../../../../__tests__/mocks/content-ui")).echoText,
}));
vi.mock("expo-router", () => ({ useRouter: () => held.router }));
vi.mock("@/components/card-slice", () => ({
  CardSlice: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/empty-card", async () => ({
  EmptyCard: (await import("../../../../__tests__/mocks/content-ui")).kit.emptyCard,
}));
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
vi.mock("../components/ai-changes-row", () => ({
  AiChangesRow: ({ onPress }: { onPress: () => void }) => (
    <button data-testid="ai-row" onClick={onPress} />
  ),
}));
vi.mock("@norish/shared-react/config", () => ({ useIngredientsSubscription: () => undefined }));
vi.mock("@norish/shared-react/ingredients", async (importActual) => ({
  ...(await importActual<object>()),
  useIngredientFiltersStore: (select: (state: unknown) => unknown) =>
    select({ filters: held.filters }),
  useIngredientIcons: () => undefined,
  useIngredientListQuery: () => ({
    items: held.rows,
    isLoading: false,
    isPaused: false,
    isPlaceholderData: false,
    hasNextPage: false,
    fetchNextPage: held.fetchNextPage,
    ...held.query,
  }),
  useIngredientTree: () => ({ rows: held.rows, toggle: held.toggle }),
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

  it("folds a food's kinds out, only for a food that has some", () => {
    render(<IngredientList />);
    fireEvent.click(screen.getByTestId("content-kinds-Rice"));
    expect(held.toggle).toHaveBeenCalledWith("Rice");
    expect((screen.getByTestId("content-kinds-Soy sauce") as HTMLButtonElement).disabled).toBe(
      true
    );
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
});
