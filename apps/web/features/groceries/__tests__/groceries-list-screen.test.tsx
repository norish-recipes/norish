import { GroceriesListScreen } from "@/features/groceries/groceries-list-screen";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

vi.mock("@/features/groceries/components/list", () => ({ ClearGroceriesModal: () => null }));
vi.mock("@/features/groceries/components/list/grocery-list", () => ({
  GroceryList: () => <p>list</p>,
}));
vi.mock("@/features/groceries/components/list/grocery-list-by-recipe", () => ({
  GroceryListByRecipe: () => <p>list</p>,
}));
vi.mock("@/features/groceries/components/list/grocery-skeleton", () => ({
  default: () => <p>skeleton</p>,
}));
vi.mock("@/features/groceries/components/panels/add-grocery-panel", () => ({
  default: () => null,
}));
vi.mock("@/features/groceries/components/panels/edit-grocery-panel", () => ({
  default: () => null,
}));
vi.mock("@/features/groceries/components/stores/store-manager-panel", () => ({
  StoreManagerPanel: () => null,
}));
vi.mock("@norish/shared-react/groceries", async (importOriginal) => ({
  ...(await importOriginal()),
  useGroceriesMutations: () => ({}),
}));
vi.mock("@norish/shared-react/reader", () => ({
  useDevicePreference: (key: string) => [key === "groceryViewMode" ? "store" : true, vi.fn()],
}));

/** Each uncached read's answer, given when the test says. */
const answers = vi.hoisted(() => new Map<string, (data: unknown) => void>());

vi.mock("@norish/shared-react/trpc", () => {
  const read = (path: string) => ({
    queryOptions: () => ({
      queryKey: [path],
      queryFn: () => new Promise((resolve) => answers.set(path, resolve)),
      staleTime: Infinity,
      retry: false,
    }),
  });
  const trpc = {
    groceries: { list: read("groceries.list") },
    stores: { list: read("stores.list"), aisleLinks: read("stores.aisleLinks") },
  };

  return { useTRPC: () => trpc };
});

const CACHED: Record<string, unknown> = {
  "groceries.list": { groceries: [], recurringGroceries: [], recipeMap: {} },
  "stores.list": [],
  "stores.aisleLinks": [],
};

/** The list screen over a cache that holds every read but `missing`. */
function renderWithout(missing: string) {
  const client = new QueryClient();

  for (const [path, data] of Object.entries(CACHED)) {
    if (path !== missing) client.setQueryData([path], data);
  }

  render(
    <QueryClientProvider client={client}>
      <GroceriesListScreen />
    </QueryClientProvider>
  );
}

describe("GroceriesListScreen", () => {
  afterEach(() => {
    answers.clear();
    onlineManager.setOnline(true);
  });

  // A switch from the Pantry after a full load of it finds the list cached but not these.
  it.each(["stores.list", "stores.aisleLinks"])(
    "shows its skeleton until %s arrives, even with the list cached",
    async (missing) => {
      renderWithout(missing);

      expect(screen.getByText("skeleton")).toBeInTheDocument();
      expect(screen.queryByText("list")).toBeNull();

      await act(async () => answers.get(missing)?.(CACHED[missing]));

      expect(await screen.findByText("list")).toBeInTheDocument();
      expect(screen.queryByText("skeleton")).toBeNull();
    }
  );

  it("draws the list Offline, where a read it never had is paused, not loading", () => {
    onlineManager.setOnline(false);
    renderWithout("stores.list");

    expect(screen.getByText("list")).toBeInTheDocument();
  });
});
