import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { GroceriesContextProvider, useGroceriesUiContext } from "@/app/(app)/groceries/context";
import { DevicePreferencesProvider } from "@/context/device-preferences-context";

import { DEVICE_PREFERENCE_DEFAULTS } from "@norish/shared/contracts/zod/device-preferences";

import { createTestQueryClient, createTestWrapper } from "../../hooks/user/test-utils";

const userQueryKey = [["user", "get"], { type: "query" }] as const;

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    user: {
      get: {
        queryKey: () => userQueryKey,
        queryOptions: () => ({ queryKey: userQueryKey, queryFn: async () => null }),
      },
      setDevicePreferences: { mutationOptions: () => ({ mutationFn: async () => ({}) }) },
    },
  }),
}));

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

function renderGroceries(values = DEVICE_PREFERENCE_DEFAULTS) {
  const Wrapper = createTestWrapper(createTestQueryClient());

  render(
    <Wrapper>
      <DevicePreferencesProvider seed={{ kind: "phone", values, signedIn: true, readAt: 0 }}>
        <GroceriesContextProvider>
          <Probe />
        </GroceriesContextProvider>
      </DevicePreferencesProvider>
    </Wrapper>
  );
}

describe("groceries Device Preferences", () => {
  it("renders the stored view and grouping from the first frame", () => {
    renderGroceries({
      ...DEVICE_PREFERENCE_DEFAULTS,
      groceryViewMode: "recipe",
      groceryGroupSimilar: false,
    });

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
