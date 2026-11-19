// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = {
  children?: ReactNode;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean };
  testID?: string;
  onPress?: () => void;
};
const host = ({ children, testID }: Props) => <div data-testid={testID}>{children}</div>;

vi.mock("react-native", () => ({
  View: host,
  Text: ({ children }: Props) => <span>{children}</span>,
  Pressable: ({ children, accessibilityLabel, accessibilityState, testID, onPress }: Props) => (
    <button
      aria-label={accessibilityLabel}
      aria-selected={accessibilityState?.selected}
      data-testid={testID}
      onClick={onPress}
    >
      {children}
    </button>
  ),
}));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: (name: string) => name }));

const { Segmented } = await import("@/components/segmented");

const segments = [
  { value: "a", label: "A", testID: "seg-a" },
  { value: "b", label: "B", testID: "seg-b" },
] as const;

function segmented(value: "a" | "b" | null, iconOnly = false) {
  const onChange = vi.fn();

  render(
    <Segmented
      iconOnly={iconOnly}
      segments={segments}
      testID="seg"
      value={value}
      onChange={onChange}
    />
  );

  return onChange;
}

describe("Segmented", () => {
  it("marks the picked segment selected", () => {
    segmented("b");

    expect(screen.getByTestId("seg-a").getAttribute("aria-selected")).toBe("false");
    expect(screen.getByTestId("seg-b").getAttribute("aria-selected")).toBe("true");
  });

  it("picks none for a null value", () => {
    segmented(null);

    expect(screen.getByTestId("seg-a").getAttribute("aria-selected")).toBe("false");
    expect(screen.getByTestId("seg-b").getAttribute("aria-selected")).toBe("false");
  });

  it("reports the pressed segment's value", () => {
    const onChange = segmented("a");

    fireEvent.click(screen.getByTestId("seg-b"));

    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("names an icon-only segment by its label alone", () => {
    segmented("a", true);

    expect(screen.getByLabelText("B").textContent).toBe("");
  });
});
