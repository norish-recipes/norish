// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type GlyphProps = {
  name: string;
  accessibilityLabel?: string;
  accessibilityElementsHidden?: boolean;
  importantForAccessibility?: string;
};
const glyph = ({ name, accessibilityLabel, accessibilityElementsHidden }: GlyphProps) => (
  <i aria-hidden={accessibilityElementsHidden} aria-label={accessibilityLabel} data-testid={name} />
);

vi.mock("@expo/vector-icons/Ionicons", () => ({ default: glyph }));
vi.mock("@expo/vector-icons/MaterialCommunityIcons", () => ({ default: glyph }));

const { Ionicons } = await import("@/components/icon");
const { MaterialCommunityIcons } = await import("@/components/material-icon");

describe("icons", () => {
  it("are hidden from accessibility, so a row's label holds no glyph", () => {
    render(
      <>
        <Ionicons name="pricetag-outline" />
        <MaterialCommunityIcons name="drag" />
      </>
    );
    expect(screen.getByTestId("pricetag-outline").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByTestId("drag").getAttribute("aria-hidden")).toBe("true");
  });

  it("are spoken when given their own label", () => {
    render(<Ionicons accessibilityLabel="Read only" name="lock-closed" />);
    expect(screen.getByLabelText("Read only").getAttribute("aria-hidden")).toBeNull();
  });
});
