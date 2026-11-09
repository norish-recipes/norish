import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { DevicePreferences } from "@norish/shared/contracts/zod/device-preferences";
import { useDevicePreference } from "@norish/shared-react/reader";

import { renderWithDevicePreferences } from "../../helpers/device-preferences";

vi.mock("@norish/shared-react/trpc", () => import("../../helpers/device-preferences-trpc"));

let setViewMode!: (mode: DevicePreferences["groceryViewMode"]) => void;
let setGroupSimilar!: (grouped: boolean) => void;

function Probe() {
  const [viewMode, setView] = useDevicePreference("groceryViewMode");
  const [groupSimilar, setGroup] = useDevicePreference("groceryGroupSimilar");

  setViewMode = setView;
  setGroupSimilar = setGroup;

  return <span data-testid="state">{`${viewMode}:${groupSimilar}`}</span>;
}

function renderGroceries(values: Partial<DevicePreferences> = {}) {
  renderWithDevicePreferences(<Probe />, { values });
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

    act(() => setViewMode("recipe"));
    act(() => setGroupSimilar(false));

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("recipe:false"));
  });
});
