import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { GroceriesContextProvider, useGroceriesUiContext } from "@/app/(app)/groceries/context";

import type { DevicePreferences } from "@norish/shared/contracts/zod/device-preferences";

import { renderWithDevicePreferences } from "../../helpers/device-preferences";

vi.mock("@/app/providers/trpc-provider", () => import("../../helpers/device-preferences-trpc"));

vi.mock("@/hooks/groceries", () => ({
  useGroceriesQuery: () => ({
    groceries: [],
    recurringGroceries: [],
    recipeMap: {},
    isLoading: false,
    getRecipeNameForGrocery: () => null,
  }),
  useGroceriesMutations: () => ({}),
  useGroceriesSubscription: () => {},
}));

let latestUi!: ReturnType<typeof useGroceriesUiContext>;

function Probe() {
  latestUi = useGroceriesUiContext();

  return (
    <span data-testid="state">{`${latestUi.viewMode}:${latestUi.groupSimilarIngredients}`}</span>
  );
}

function renderGroceries(values: Partial<DevicePreferences> = {}) {
  renderWithDevicePreferences(
    <GroceriesContextProvider>
      <Probe />
    </GroceriesContextProvider>,
    { values }
  );
}

describe("groceries Device Preferences", () => {
  it("renders the stored view and grouping from the first frame", () => {
    renderGroceries({ groceryViewMode: "recipe", groceryGroupSimilar: false });

    expect(screen.getByTestId("state")).toHaveTextContent("recipe:false");
  });

  it("defaults to the store view with grouping on", () => {
    renderGroceries();

    expect(screen.getByTestId("state")).toHaveTextContent("store:true");
  });

  it("switches the view and grouping at once", () => {
    renderGroceries();

    act(() => latestUi.setViewMode("recipe"));
    act(() => latestUi.setGroupSimilarIngredients(false));

    expect(screen.getByTestId("state")).toHaveTextContent("recipe:false");
  });
});
