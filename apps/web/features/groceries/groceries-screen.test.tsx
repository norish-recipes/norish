import { GroceriesScreen } from "@/features/groceries/groceries-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useGroceriesUiStore } from "@norish/shared-react/groceries";

const screen = vi.hoisted(() => ({ renders: 0 }));

// The screen reads its path once a render, and nothing under it does: this counts its renders.
vi.mock("next/navigation", () => ({
  usePathname: () => {
    screen.renders += 1;

    return "/groceries";
  },
}));
vi.mock("@/features/groceries/components", () => ({ PantryView: () => null }));
vi.mock("@/features/groceries/components/groceries-page", () => ({ GroceriesPage: () => null }));
vi.mock("@/features/groceries/components/groceries-header", () => ({
  GroceriesHeader: () => null,
  VIEW_TRANSITION: {},
}));
vi.mock("@/features/groceries/components/add-grocery-button", () => ({ default: () => null }));
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

describe("GroceriesScreen", () => {
  it("holds the Pantry's reads for its first visit without rendering again when they change", async () => {
    const queryClient = new QueryClient();
    const read = (key: string) => queryClient.getQueryCache().find({ queryKey: ["pantry", key] });

    render(
      <QueryClientProvider client={queryClient}>
        <GroceriesScreen />
      </QueryClientProvider>
    );

    await waitFor(() => expect(read("list")?.state.status).toBe("success"));
    await waitFor(() => expect(read("suggestions")?.state.status).toBe("success"));
    const settled = screen.renders;

    act(() => {
      queryClient.setQueryData(["pantry", "list"], [{ id: "p1" }]);
      queryClient.setQueryData(["pantry", "suggestions"], [{ id: "s1" }]);
    });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(screen.renders).toBe(settled);
    expect(read("list")?.getObserversCount()).toBe(1);
    expect(read("suggestions")?.getObserversCount()).toBe(1);
  });

  it("leaves with every panel closed, so the next visit opens on the list alone", () => {
    const view = render(
      <QueryClientProvider client={new QueryClient()}>
        <GroceriesScreen />
      </QueryClientProvider>
    );

    useGroceriesUiStore.getState().setStoreManagerOpen(true);
    useGroceriesUiStore.getState().setEditingGroceryId("g1");
    view.unmount();

    expect(useGroceriesUiStore.getState()).toMatchObject({
      storeManagerOpen: false,
      editingGroceryId: null,
    });
  });
});
