import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { GroceriesUiProvider, useGroceriesUiContext } from "@/app/(app)/groceries/context";

import type { DevicePreferences } from "@norish/shared/contracts/zod/device-preferences";

import { renderWithDevicePreferences } from "../../helpers/device-preferences";

vi.mock("@norish/shared-react/trpc", () => import("../../helpers/device-preferences-trpc"));

let latestUi!: ReturnType<typeof useGroceriesUiContext>;

function Probe() {
  latestUi = useGroceriesUiContext();

  return (
    <span data-testid="state">{`${latestUi.viewMode}:${latestUi.groupSimilarIngredients}`}</span>
  );
}

function renderGroceries(values: Partial<DevicePreferences> = {}) {
  renderWithDevicePreferences(
    <GroceriesUiProvider>
      <Probe />
    </GroceriesUiProvider>,
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

  it("switches the view and grouping at once", async () => {
    renderGroceries();

    act(() => latestUi.setViewMode("recipe"));
    act(() => latestUi.setGroupSimilarIngredients(false));

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("recipe:false"));
  });
});
