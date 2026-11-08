import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";

import { renderWithDevicePreferences } from "../helpers/device-preferences";

vi.mock("@norish/shared-react/trpc", () => import("../helpers/device-preferences-trpc"));

let latest!: ReturnType<typeof useAmountDisplayPreference>;

function Probe() {
  latest = useAmountDisplayPreference();

  return <span data-testid="mode">{latest.mode}</span>;
}

describe("useAmountDisplayPreference", () => {
  it("keeps the shared hook's interface over the stored mode", () => {
    renderWithDevicePreferences(<Probe />, { values: { amountDisplay: "decimal" } });

    expect(screen.getByTestId("mode")).toHaveTextContent("decimal");
  });

  it("toggles between the two formats", async () => {
    renderWithDevicePreferences(<Probe />);

    expect(screen.getByTestId("mode")).toHaveTextContent("fraction");

    act(() => latest.toggleMode());

    await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("decimal"));

    act(() => latest.toggleMode());

    await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("fraction"));
  });

  it("sets an explicit mode", async () => {
    renderWithDevicePreferences(<Probe />);

    act(() => latest.setMode("decimal"));

    await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("decimal"));
  });

  it("lets a signed-out reader of a shared recipe switch for the visit", async () => {
    renderWithDevicePreferences(<Probe />, { forVisit: true });

    act(() => latest.toggleMode());

    await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("decimal"));
  });
});
