import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import "@testing-library/jest-dom";

import type { DevicePreferenceState } from "@/context/device-preference-context";
import { createDevicePreferenceContext } from "@/context/device-preference-context";
import { defineDevicePreference } from "@/lib/device-preferences";

const preference = defineDevicePreference({
  cookieName: "norish_test_context_preference",
  values: ["alpha", "beta"] as const,
  defaultValue: "alpha",
});

const { Provider, usePreference } = createDevicePreferenceContext(preference, "TestPreference");

let latestSet!: DevicePreferenceState<"alpha" | "beta">[1];

function Probe() {
  const [value, setValue] = usePreference();

  latestSet = setValue;

  return <span data-testid="value">{value}</span>;
}

beforeEach(() => {
  document.cookie = `${preference.cookieName}=;path=/;max-age=0`;
});

describe("createDevicePreferenceContext", () => {
  it("seeds from the server-read value when one was passed", () => {
    render(
      <Provider initialValue="beta">
        <Probe />
      </Provider>
    );

    expect(screen.getByTestId("value")).toHaveTextContent("beta");
  });

  it("reads the cookie itself when there was no server pass", () => {
    // The offline bootstrap mounts client-side with nothing seeded.
    preference.writeCookie("beta");

    render(
      <Provider>
        <Probe />
      </Provider>
    );

    expect(screen.getByTestId("value")).toHaveTextContent("beta");
  });

  it("falls back to the default with no seed and no cookie", () => {
    render(
      <Provider>
        <Probe />
      </Provider>
    );

    expect(screen.getByTestId("value")).toHaveTextContent("alpha");
  });

  it("reconciles a stale seed against the cookie once mounted", () => {
    // The service worker can answer a navigation with cached HTML that
    // predates the last toggle; the cookie stays authoritative.
    preference.writeCookie("beta");

    render(
      <Provider initialValue="alpha">
        <Probe />
      </Provider>
    );

    expect(screen.getByTestId("value")).toHaveTextContent("beta");
  });

  it("writes the cookie and updates every consumer on selection", () => {
    render(
      <Provider initialValue="alpha">
        <Probe />
      </Provider>
    );

    act(() => latestSet("beta"));

    expect(screen.getByTestId("value")).toHaveTextContent("beta");
    expect(preference.readCookie()).toBe("beta");
  });

  it("supports a functional update reading the previous value", () => {
    render(
      <Provider initialValue="alpha">
        <Probe />
      </Provider>
    );

    act(() => latestSet((prev) => (prev === "alpha" ? "beta" : "alpha")));

    expect(screen.getByTestId("value")).toHaveTextContent("beta");
    expect(preference.readCookie()).toBe("beta");
  });

  it("throws when used outside its provider", () => {
    expect(() => render(<Probe />)).toThrow(/TestPreference/);
  });
});
