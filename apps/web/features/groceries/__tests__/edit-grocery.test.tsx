import { EditGrocery } from "@/features/groceries/groceries-list-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useGroceriesUiStore } from "@norish/shared-react/groceries";

vi.mock("@/features/groceries/components/panels/edit-grocery-panel", () => ({
  default: ({ grocery }: { grocery: { name: string } }) => (
    <p data-testid="edit-panel">{grocery.name}</p>
  ),
}));
vi.mock("@norish/shared-react/groceries", async (importOriginal) => ({
  ...(await importOriginal()),
  useGroceriesMutations: () => ({}),
}));
vi.mock("@norish/shared-react/trpc", () => {
  const trpc = {
    groceries: {
      list: { queryOptions: () => ({ queryKey: ["groceries", "list"], staleTime: Infinity }) },
    },
  };

  return { useTRPC: () => trpc };
});

const list = (groceries: Array<{ id: string; name: string }>) => ({
  groceries,
  recurringGroceries: [],
  recipeMap: {},
});

describe("EditGrocery", () => {
  afterEach(() => useGroceriesUiStore.getState().reset());

  it("shows the grocery as the list holds it, and closes once a housemate deletes it", async () => {
    const client = new QueryClient();

    client.setQueryData(["groceries", "list"], list([{ id: "g1", name: "milk" }]));
    useGroceriesUiStore.getState().setEditingGroceryId("g1");
    render(
      <QueryClientProvider client={client}>
        <EditGrocery stores={[]} />
      </QueryClientProvider>
    );
    expect(screen.getByTestId("edit-panel").textContent).toBe("milk");

    act(() => client.setQueryData(["groceries", "list"], list([{ id: "g1", name: "oat milk" }])));
    await waitFor(() => expect(screen.getByTestId("edit-panel").textContent).toBe("oat milk"));

    act(() => client.setQueryData(["groceries", "list"], list([])));
    await waitFor(() => expect(screen.queryByTestId("edit-panel")).toBeNull());
  });
});
