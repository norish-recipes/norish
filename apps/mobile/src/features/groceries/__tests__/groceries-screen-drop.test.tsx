// @vitest-environment jsdom
/** The screen's drop, through the real by-Store plan, to the writes it makes. */
import type { Drop } from "@/components/drag-list/resolve-drop";
import { resolveDrop } from "@/components/drag-list/resolve-drop";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";

import type { ListHeading, ListItem, ListRow } from "../utils/list-rows";

const store = (id: string, sortOrder: number, aisles: string[] = []) =>
  ({
    id,
    name: id,
    sortOrder,
    color: "primary",
    aisles: aisles.map((aisle, index) => ({
      id: aisle,
      storeId: id,
      name: aisle,
      sortOrder: index,
    })),
  }) as unknown as StoreDto;
const line = (id: string, storeId: string | null, sortOrder: number) =>
  ({
    id,
    name: id,
    storeId,
    isDone: false,
    sortOrder,
    ingredientId: `i-${id}`,
    amount: null,
    unit: null,
    recipeIngredientId: null,
    version: 1,
  }) as unknown as GroceryDto;

const STORES = [store("markt", 0, ["dairy"]), store("bakker", 1)];
const LIST = [
  line("apples", "markt", 0),
  line("pears", "markt", 1),
  line("cheese", "markt", 2),
  line("bread", "bakker", 0),
];
const writes = vi.hoisted(() => ({ reorder: vi.fn(), file: vi.fn() }));
const list = vi.hoisted(
  () =>
    ({}) as {
      rows: ListRow[];
      onDrop: (drop: Drop<ListHeading, ListItem>) => boolean;
    }
);

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
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@norish/shared-react/config", () => ({
  useIngredientsSubscription: () => undefined,
  useUnitsQuery: () => ({ units: {} }),
}));
vi.mock("@norish/shared-react/reader", () => ({
  useDevicePreference: (key: string) => [key === "groceryViewMode" ? "store" : false, vi.fn()],
}));
vi.mock("@norish/shared-react/groceries", async (importActual) => ({
  ...(await importActual<object>()),
  useAisleLinksLoading: () => false,
  useGroceriesMutations: () => ({ reorderGroceriesInStore: writes.reorder }),
  useGroceriesQuery: () => ({
    isLoading: false,
    isRead: true,
    groceries: LIST,
    recurringGroceries: [],
    recipeMap: {},
    getRecipeNameForGrocery: () => null,
  }),
  useGroceriesSubscription: () => undefined,
  // Markt files cheese under Dairy.
  useStoreAisles: () => ({
    aisleFor: (storeId: string | null, ingredientId: string | null | undefined) =>
      storeId === "markt" && ingredientId === "i-cheese" ? "dairy" : null,
  }),
  useStoreAislesSubscription: () => undefined,
  useStorePricesSubscription: () => undefined,
  useStoresQuery: () => ({ isLoading: false, isRead: true, stores: STORES }),
  useStoresSubscription: () => undefined,
  useFileGroceryName: () => writes.file,
}));
vi.mock("../components/groceries-list", () => ({
  GroceriesList: (props: typeof list) => {
    Object.assign(list, props);

    return null;
  },
}));
vi.mock("../components/groceries-states", () => ({
  GroceriesEmpty: () => null,
  GroceriesSkeleton: () => null,
}));
vi.mock("@/components/tab-root-header", () => ({ TabRootHeader: () => null }));
vi.mock("@/lib/use-tab-scroll", () => import("../../../../__tests__/mocks/use-tab-scroll"));
vi.mock("../components/list-switch", () => ({ ListSwitch: () => null }));

const { GroceriesScreen } = await import("../screens/groceries-screen");

/** Drops the row `key` where `toKey` is, as the drag list reports it. */
function dropOnScreen(key: string, toKey: string) {
  writes.reorder.mockClear();
  writes.file.mockClear();
  render(<GroceriesScreen />);
  const at = (k: string) => list.rows.findIndex((row) => row.key === k);
  let landed = false;

  act(() => {
    landed = list.onDrop(resolveDrop(list.rows, at(key), at(toKey))!);
  });

  return landed;
}

describe("the Groceries screen's drop", () => {
  it("moves a line to another Store", () => {
    expect(dropOnScreen("line:apples", "line:bread")).toBe(true);

    expect(writes.reorder).toHaveBeenCalledOnce();
    expect(writes.reorder.mock.calls[0]?.[0]).toContainEqual({
      id: "apples",
      sortOrder: 1,
      storeId: "bakker",
    });
    expect(writes.file).not.toHaveBeenCalled();
  });

  it("files a line dropped under an Aisle heading there", () => {
    expect(dropOnScreen("line:apples", "line:cheese")).toBe(true);

    expect(writes.file).toHaveBeenCalledWith(
      "markt",
      expect.objectContaining({ id: "apples" }),
      "dairy"
    );
  });
});
