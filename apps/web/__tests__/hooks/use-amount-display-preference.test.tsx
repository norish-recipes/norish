import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";

import { renderWithDevicePreferences } from "../helpers/device-preferences";

vi.mock("@/app/providers/trpc-provider", () => import("../helpers/device-preferences-trpc"));

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

  it("toggles between the two formats", () => {
    renderWithDevicePreferences(<Probe />);

    expect(screen.getByTestId("mode")).toHaveTextContent("fraction");

    act(() => latest.toggleMode());

    expect(screen.getByTestId("mode")).toHaveTextContent("decimal");

    act(() => latest.toggleMode());

    expect(screen.getByTestId("mode")).toHaveTextContent("fraction");
  });

  it("sets an explicit mode", () => {
    renderWithDevicePreferences(<Probe />);

    act(() => latest.setMode("decimal"));

    expect(screen.getByTestId("mode")).toHaveTextContent("decimal");
  });

  it("lets a signed-out reader of a shared recipe switch for the visit", () => {
    renderWithDevicePreferences(<Probe />, { seed: { signedIn: false } });

    act(() => latest.toggleMode());

    expect(screen.getByTestId("mode")).toHaveTextContent("decimal");
  });
});
