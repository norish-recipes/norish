// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTabScroll } from "../../../../__tests__/mocks/use-tab-scroll";

const read = vi.hoisted(() => ({
  groceries: { isLoading: false, isSuccess: true, isRead: true, groceries: [] as unknown[] },
  stores: { isLoading: false, isSuccess: true, isRead: true, stores: [] as unknown[] },
}));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    Text: ({ children }: { children: React.ReactNode }) => createElement("span", null, children),
    View: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
  };
});
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
vi.mock("@/lib/haptics", () => ({ lightImpact: () => {} }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@norish/shared-react/config", () => ({
  useUnitsQuery: () => ({ units: {} }),
}));
vi.mock("@norish/shared-react/reader", () => ({
  useDevicePreference: (key: string) => [key === "groceryViewMode" ? "store" : false, vi.fn()],
}));
vi.mock("@norish/shared-react/groceries", () => ({
  groupGroceriesByRecipe: () => [],
  useAisleLinksLoading: () => false,
  useGroceriesMutations: () => ({}),
  useGroceriesQuery: () => ({
    ...read.groceries,
    recurringGroceries: [],
    recipeMap: {},
    getRecipeNameForGrocery: () => null,
  }),
  useStoreAisles: () => ({ aisleFor: () => null }),
  useStoresQuery: () => read.stores,
  useFileGroceryName: () => vi.fn(),
  writeDrop: vi.fn(),
}));
vi.mock("../components/groceries-list", () => ({
  GroceriesList: ({ empty }: { empty: React.ReactNode }) => empty,
}));
vi.mock("../components/groceries-states", () => ({
  GroceriesEmpty: () => <p>empty</p>,
  GroceriesSkeleton: () => <p>skeleton</p>,
}));
vi.mock("@/components/tab-root-header", () => ({ TabRootHeader: () => null }));
vi.mock("../components/list-switch", () => ({ ListSwitchSpace: () => null }));
vi.mock("../utils/list-rows", () => ({ recipeListRows: () => [], storeListRows: () => [] }));
vi.mock("../utils/grocery-drop", () => ({ planRecipeRowDrop: vi.fn(), planStoreRowDrop: vi.fn() }));

const { GroceryListSection } = await import("../components/grocery-list-section");
const scroll = useTabScroll();
// Nothing folded, as the page starts.
const state = {
  doneOpen: new Set<string>(),
  setDoneOpen: vi.fn(),
  collapsed: new Set<string>(),
  setCollapsed: vi.fn(),
  openGroups: new Set<string>(),
  setOpenGroups: vi.fn(),
};

describe("the Groceries list's first frame", () => {
  beforeEach(() => {
    read.groceries = { isLoading: false, isSuccess: true, isRead: true, groceries: [] };
    read.stores = { isLoading: false, isSuccess: true, isRead: true, stores: [] };
  });

  it("shows the empty state once the list was read and holds nothing", () => {
    render(<GroceryListSection scroll={scroll} state={state} />);

    expect(screen.queryByText("empty")).not.toBeNull();
  });

  it("shows the empty state when a refetch of the empty list failed", () => {
    read.groceries = { isLoading: false, isSuccess: false, isRead: true, groceries: [] };
    read.stores = { isLoading: false, isSuccess: false, isRead: true, stores: [] };
    render(<GroceryListSection scroll={scroll} state={state} />);

    expect(screen.queryByText("empty")).not.toBeNull();
  });

  it("keeps the skeleton when the read failed with nothing cached", () => {
    read.groceries = { isLoading: false, isSuccess: false, isRead: false, groceries: [] };
    render(<GroceryListSection scroll={scroll} state={state} />);

    expect(screen.queryByText("skeleton")).not.toBeNull();
    expect(screen.queryByText("empty")).toBeNull();
  });
});
