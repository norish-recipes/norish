import { FloatingBarStyleSync } from "@/components/floating-bar-style";
import { FloatingBarStyleScript } from "@/components/floating-bar-style-script";
import { applyFloatingBarStyle, FLOATING_BAR_ATTRIBUTE } from "@/lib/floating-bar-style";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FloatingBarStyle } from "@norish/shared/contracts/zod/device-preferences";

const preference = vi.hoisted(() => ({ style: "contrast" as FloatingBarStyle }));

vi.mock("@norish/shared-react/reader", async () => ({
  ...(await (
    await import("@/__tests__/helpers/reader-mock")
  ).mockDevicePreferences(() => ({ floatingBarStyle: preference.style }))),
}));

const attribute = () => document.documentElement.getAttribute(FLOATING_BAR_ATTRIBUTE);

afterEach(() => {
  preference.style = "contrast";
  document.documentElement.removeAttribute(FLOATING_BAR_ATTRIBUTE);
});

describe("floating bar style", () => {
  it("sets the attribute for match and none for the default contrast", () => {
    applyFloatingBarStyle("match");
    expect(attribute()).toBe("match");

    applyFloatingBarStyle("contrast");
    expect(attribute()).toBeNull();
  });

  it("puts the reader's style on <html> and takes it off when the page goes", () => {
    preference.style = "match";

    const { unmount } = render(<FloatingBarStyleSync />);

    expect(attribute()).toBe("match");

    unmount();

    expect(attribute()).toBeNull();
  });

  it("follows a change of the preference", () => {
    preference.style = "match";

    const { rerender } = render(<FloatingBarStyleSync />);

    preference.style = "contrast";
    rerender(<FloatingBarStyleSync />);

    expect(attribute()).toBeNull();
  });

  it("leaves <html> alone for contrast", () => {
    render(<FloatingBarStyleSync />);

    expect(attribute()).toBeNull();
  });

  it("renders the first-paint script for match only", () => {
    expect(renderToStaticMarkup(<FloatingBarStyleScript style="contrast" />)).toBe("");
    expect(renderToStaticMarkup(<FloatingBarStyleScript style="match" />)).toContain(
      `setAttribute("${FLOATING_BAR_ATTRIBUTE}", "match")`
    );
  });
});
