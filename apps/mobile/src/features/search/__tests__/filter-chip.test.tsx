// @vitest-environment jsdom
/** An Ingredient chip is named from the cache an add primes, never blank, and always removable. */
import type { ReactNode } from "react";
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useIngredientNames } from "@norish/shared-react/ingredients";
import { createOfflineQueryClient } from "@norish/shared-react/offline";
import {
  createLibraryFiltersStore,
  LibraryFiltersProvider,
  useLibraryFilters,
} from "@norish/shared-react/recipes";
import { DEFAULT_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

type Props = {
  children?: ReactNode;
  accessibilityLabel?: string;
  testID?: string;
  onPress?: () => void;
};

const mocks = vi.hoisted(() => ({
  reads: [] as string[][],
  skeletons: 0,
  names: {} as Record<string, { name: string; localeNames: Record<string, string> }>,
}));

vi.mock("react-native", () => ({ Text: ({ children }: Props) => <span>{children}</span> }));
vi.mock("@/components/pressable-scale", () => ({
  PressableScale: ({ children, accessibilityLabel, testID, onPress }: Props) => (
    <button aria-label={accessibilityLabel} data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/ingredient-icon", () => ({ IngredientIcon: () => null }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: (name: string) => name }));
vi.mock("heroui-native", () => ({
  Skeleton: () => {
    mocks.skeletons += 1;

    return <i data-testid="skeleton" />;
  },
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({
    locale: "nl",
    formatMessage: ({ id }: { id: string }, values?: Record<string, string>) =>
      values ? `${id}(${Object.values(values).join()})` : id,
  }),
}));
vi.mock("@norish/shared-react/trpc", () => ({
  useTRPC: () => ({
    ingredients: {
      names: {
        pathKey: () => [["ingredients", "names"]],
        queryKey: (input: { ids: string[] }) => [["ingredients", "names"], { input }],
        queryOptions: (input: { ids: string[] }) => ({
          queryKey: [["ingredients", "names"], { input }],
          queryFn: async () => {
            mocks.reads.push(input.ids);

            return Object.fromEntries(
              input.ids.flatMap((id) => (mocks.names[id] ? [[id, mocks.names[id]]] : []))
            );
          },
        }),
      },
    },
  }),
}));

const { FilterChipView } = await import("../components/filter-chip");
const { useAddIngredient } = await import("../hooks/use-add-ingredient");

function Chips() {
  const ids = useLibraryFilters((state) => state.filters.ingredients);
  const setFilters = useLibraryFilters((state) => state.setFilters);
  const add = useAddIngredient();

  useIngredientNames(ids);

  return (
    <>
      {ids.map((id) => (
        <FilterChipView
          key={id}
          chip={{ kind: "ingredient", value: id }}
          onRemove={() => setFilters({ ingredients: ids.filter((other) => other !== id) })}
        />
      ))}
      <button onClick={() => add({ id: "garlic-id", name: "garlic", localeNames: {} })}>add</button>
      <button
        onClick={() => add({ id: "chicken-id", name: "Chicken", localeNames: { nl: "Kip" } })}
      >
        add chicken
      </button>
    </>
  );
}

function renderChips(ingredients: string[]) {
  const store = createLibraryFiltersStore({ ...DEFAULT_RECIPE_FILTERS, ingredients });

  const client = createOfflineQueryClient();

  mocks.reads = [];
  mocks.skeletons = 0;
  mocks.names = {};
  render(
    <QueryClientProvider client={client}>
      <LibraryFiltersProvider store={store}>
        <Chips />
      </LibraryFiltersProvider>
    </QueryClientProvider>
  );

  return { store, client };
}

describe("an Ingredient chip", () => {
  it("is named in the first render after the add, reading nothing", () => {
    renderChips([]);

    act(() => fireEvent.click(screen.getByText("add")));

    expect(screen.getByTestId("search-chip-ingredient:garlic-id").textContent).toBe("garlic");
    expect(screen.getByLabelText("recipes.search.removeFilter(garlic)")).toBeTruthy();
    expect(mocks.skeletons).toBe(0);
    expect(mocks.reads).toEqual([]);
  });

  it("keeps the reader's language after a refetch answers the same food", async () => {
    const { client } = renderChips([]);

    act(() => fireEvent.click(screen.getByText("add chicken")));
    expect(screen.getByTestId("search-chip-ingredient:chicken-id").textContent).toBe("Kip");

    mocks.names = { "chicken-id": { name: "Chicken", localeNames: { nl: "Kip" } } };
    await act(() => client.invalidateQueries());

    await waitFor(() => expect(mocks.reads).toContainEqual(["chicken-id"]));
    expect(screen.getByTestId("search-chip-ingredient:chicken-id").textContent).toBe("Kip");
  });

  it("shows a placeholder for a food no read names, and is still removable", async () => {
    const { store } = renderChips(["gone-id"]);

    await waitFor(() => expect(mocks.reads).toEqual([["gone-id"]]));
    expect(screen.getByTestId("skeleton")).toBeTruthy();

    fireEvent.click(
      screen.getByLabelText("recipes.search.removeFilter(recipes.search.ingredientFilter)")
    );

    expect(store.getState().filters.ingredients).toEqual([]);
  });
});
