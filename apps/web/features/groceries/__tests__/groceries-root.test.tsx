import { GroceriesRoot } from "@/features/groceries/groceries-root";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { useGroceriesUiStore } from "@norish/shared-react/groceries";

const path = vi.hoisted(() => ({ current: "/groceries" }));

vi.mock("next/navigation", () => ({ usePathname: () => path.current }));
vi.mock("@/features/groceries/components/header/groceries-header", () => ({
  GroceriesHeader: ({ view }: { view: string }) => <h1>{view}</h1>,
  VIEW_TRANSITION: {},
}));
vi.mock("@/features/groceries/components/list/add-grocery-button", () => ({
  default: () => <button type="button">add</button>,
}));
vi.mock("@/features/groceries/groceries-list-screen", () => ({
  GroceriesListScreen: () => <p>list screen</p>,
}));
vi.mock("@/features/groceries/pantry-screen", () => ({ PantryScreen: () => <p>pantry screen</p> }));
vi.mock("@norish/shared-react/groceries", async (importOriginal) => ({
  ...(await importOriginal()),
  useGroceriesSubscription: () => undefined,
  useStoresSubscription: () => undefined,
  useStorePricesSubscription: () => undefined,
  useStoreAislesSubscription: () => undefined,
  usePantrySubscription: () => undefined,
}));
vi.mock("@norish/shared-react/config", async (importOriginal) => ({
  ...(await importOriginal()),
  useIngredientsSubscription: () => undefined,
}));

describe("GroceriesRoot", () => {
  afterEach(() => {
    path.current = "/groceries";
  });

  it("draws the view its address names under the header, and the add pill on the list only", async () => {
    const view = render(<GroceriesRoot />);

    expect(screen.getByRole("heading")).toHaveTextContent("list");
    expect(screen.getByText("list screen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "add" })).toBeInTheDocument();

    path.current = "/groceries/pantry";
    view.rerender(<GroceriesRoot />);

    expect(screen.getByRole("heading")).toHaveTextContent("pantry");
    expect(screen.getByText("pantry screen")).toBeInTheDocument();
    // The list slides out and the pill fades out first.
    await waitFor(() => expect(screen.queryByText("list screen")).toBeNull());
    await waitFor(() => expect(screen.queryByRole("button", { name: "add" })).toBeNull());
  });

  it("leaves with every panel closed, so the next visit opens on the list alone", () => {
    const view = render(<GroceriesRoot />);

    useGroceriesUiStore.getState().setStoreManagerOpen(true);
    useGroceriesUiStore.getState().setEditingGroceryId("g1");
    view.unmount();

    expect(useGroceriesUiStore.getState()).toMatchObject({
      storeManagerOpen: false,
      editingGroceryId: null,
    });
  });
});
