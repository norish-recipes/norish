import { Profiler } from "react";
import { GroceriesScreen } from "@/app/(app)/groceries/groceries-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GroceryDto } from "@norish/shared/contracts";
import { useGroceriesUiStore } from "@norish/shared-react/groceries";

vi.mock("next/navigation", () => ({ usePathname: () => "/groceries" }));
vi.mock("@/components/groceries", () => ({ PantryView: () => null }));
vi.mock("@/app/(app)/groceries/components/groceries-page", () => ({ GroceriesPage: () => null }));
vi.mock("@/app/(app)/groceries/components/groceries-header", () => ({
  GroceriesHeader: () => null,
  VIEW_TRANSITION: {},
}));
vi.mock("@/app/(app)/groceries/components/add-grocery-button", () => ({ default: () => null }));
vi.mock("@norish/shared-react/groceries", async (importOriginal) => ({
  ...(await importOriginal()),
  useGroceriesSubscription: () => undefined,
  useStoresSubscription: () => undefined,
  useStorePricesSubscription: () => undefined,
  useStoreAislesSubscription: () => undefined,
}));
vi.mock("@norish/shared-react/offline/react", () => ({
  useConnectivity: () => ({ isOffline: false }),
}));
vi.mock("@norish/shared-react/trpc", () => {
  const read = (queryKey: string[]) => ({
    queryOptions: () => ({ queryKey, queryFn: async () => [] }),
  });
  const trpc = {
    pantry: { list: read(["pantry", "list"]), suggestions: read(["pantry", "suggestions"]) },
  };

  return { useTRPC: () => trpc };
});

const MILK: GroceryDto = {
  id: "g1",
  version: 1,
  name: "milk",
  amount: null,
  unit: null,
  isDone: false,
  recipeIngredientId: null,
  recurringGroceryId: null,
  storeId: null,
  sortOrder: 0,
};

describe("GroceriesScreen", () => {
  it("holds the Pantry's reads for its first visit without rendering again when they change", async () => {
    const queryClient = new QueryClient();
    let renders = 0;

    render(
      <QueryClientProvider client={queryClient}>
        <Profiler id="screen" onRender={() => renders++}>
          <GroceriesScreen />
        </Profiler>
      </QueryClientProvider>
    );

    const pantry = () => queryClient.getQueryCache().find({ queryKey: ["pantry", "list"] });

    await waitFor(() => expect(pantry()?.state.status).toBe("success"));
    const settled = renders;

    act(() => {
      queryClient.setQueryData(["pantry", "list"], [{ id: "p1" }]);
      queryClient.setQueryData(["pantry", "suggestions"], [{ id: "s1" }]);
    });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(renders).toBe(settled);
    expect(pantry()?.getObserversCount()).toBe(1);
  });

  it("leaves with every panel closed, so the next visit opens on the list alone", () => {
    const screen = render(
      <QueryClientProvider client={new QueryClient()}>
        <GroceriesScreen />
      </QueryClientProvider>
    );

    useGroceriesUiStore.getState().setStoreManagerOpen(true);
    useGroceriesUiStore.getState().setEditingGrocery(MILK);
    screen.unmount();

    expect(useGroceriesUiStore.getState()).toMatchObject({
      storeManagerOpen: false,
      editingGrocery: null,
    });
  });
});
