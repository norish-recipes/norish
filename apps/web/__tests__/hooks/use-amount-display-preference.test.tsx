import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import "@testing-library/jest-dom";

import { AmountDisplayProvider } from "@/context/amount-display-context";
import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";
import { amountDisplayPreference } from "@/lib/amount-display";

let latest!: ReturnType<typeof useAmountDisplayPreference>;

function Probe() {
  latest = useAmountDisplayPreference();

  return <span data-testid="mode">{latest.mode}</span>;
}

beforeEach(() => {
  document.cookie = `${amountDisplayPreference.cookieName}=;path=/;max-age=0`;
});

describe("useAmountDisplayPreference", () => {
  it("keeps the shared hook's interface over the seeded cookie value", () => {
    render(
      <AmountDisplayProvider initialValue="decimal">
        <Probe />
      </AmountDisplayProvider>
    );

    expect(screen.getByTestId("mode")).toHaveTextContent("decimal");
  });

  it("reads the cookie itself when nothing was seeded", () => {
    amountDisplayPreference.writeCookie("decimal");

    render(
      <AmountDisplayProvider>
        <Probe />
      </AmountDisplayProvider>
    );

    expect(screen.getByTestId("mode")).toHaveTextContent("decimal");
  });

  it("toggles between the two formats and persists the choice", () => {
    render(
      <AmountDisplayProvider>
        <Probe />
      </AmountDisplayProvider>
    );

    expect(screen.getByTestId("mode")).toHaveTextContent("fraction");

    act(() => latest.toggleMode());

    expect(screen.getByTestId("mode")).toHaveTextContent("decimal");
    expect(amountDisplayPreference.readCookie()).toBe("decimal");

    act(() => latest.toggleMode());

    expect(screen.getByTestId("mode")).toHaveTextContent("fraction");
    expect(amountDisplayPreference.readCookie()).toBe("fraction");
  });

  it("sets an explicit mode", () => {
    render(
      <AmountDisplayProvider>
        <Probe />
      </AmountDisplayProvider>
    );

    act(() => latest.setMode("decimal"));

    expect(screen.getByTestId("mode")).toHaveTextContent("decimal");
    expect(amountDisplayPreference.readCookie()).toBe("decimal");
  });
});
