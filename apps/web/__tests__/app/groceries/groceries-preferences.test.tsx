import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { GroceriesContextProvider, useGroceriesUiContext } from "@/app/(app)/groceries/context";
import {
  groceryGroupSimilarPreference,
  groceryViewModePreference,
} from "@/lib/grocery-preferences";

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

function clearCookie(name: string) {
  document.cookie = `${name}=;path=/;max-age=0`;
}

beforeEach(() => {
  clearCookie(groceryViewModePreference.cookieName);
  clearCookie(groceryGroupSimilarPreference.cookieName);
});

describe("groceries device preferences", () => {
  it("renders the seeded view and grouping from the first frame", () => {
    render(
      <GroceriesContextProvider initialGroupSimilar="false" initialViewMode="recipe">
        <Probe />
      </GroceriesContextProvider>
    );

    expect(screen.getByTestId("state")).toHaveTextContent("recipe:false");
  });

  it("defaults to the store view with grouping on", () => {
    render(
      <GroceriesContextProvider>
        <Probe />
      </GroceriesContextProvider>
    );

    expect(screen.getByTestId("state")).toHaveTextContent("store:true");
  });

  it("reads the cookies itself when nothing was seeded", () => {
    // The offline bootstrap mounts the screen with no server pass.
    groceryViewModePreference.writeCookie("recipe");
    groceryGroupSimilarPreference.writeCookie("false");

    render(
      <GroceriesContextProvider>
        <Probe />
      </GroceriesContextProvider>
    );

    expect(screen.getByTestId("state")).toHaveTextContent("recipe:false");
  });

  it("persists a toggled view and grouping to the cookies", () => {
    render(
      <GroceriesContextProvider>
        <Probe />
      </GroceriesContextProvider>
    );

    act(() => latestUi.setViewMode("recipe"));
    act(() => latestUi.setGroupSimilarIngredients(false));

    expect(screen.getByTestId("state")).toHaveTextContent("recipe:false");
    expect(groceryViewModePreference.readCookie()).toBe("recipe");
    expect(groceryGroupSimilarPreference.readCookie()).toBe("false");
  });
});
