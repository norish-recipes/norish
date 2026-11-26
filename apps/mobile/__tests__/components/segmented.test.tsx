// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = {
  children?: ReactNode;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityState?: { selected?: boolean; checked?: boolean };
  className?: string;
  testID?: string;
  onPress?: () => void;
};
const host = ({ children, testID, accessibilityRole, accessibilityLabel }: Props) => (
  <div aria-label={accessibilityLabel} data-testid={testID} role={accessibilityRole}>
    {children}
  </div>
);

vi.mock("react-native", () => ({
  View: host,
  Text: ({ children }: Props) => <span>{children}</span>,
  Pressable: ({
    children,
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    className,
    testID,
    onPress,
  }: Props) => (
    <button
      aria-label={accessibilityLabel}
      className={className}
      aria-selected={accessibilityState?.selected}
      aria-checked={accessibilityState?.checked}
      role={accessibilityRole}
      data-testid={testID}
      onClick={onPress}
    >
      {children}
    </button>
  ),
}));
vi.mock("react-native-reanimated", () => import("./../mocks/reanimated"));
vi.mock("@/lib/motion/spring", () => ({ springTo: (to: number) => to }));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: (name: string) => name }));

const { Segmented } = await import("@/components/segmented");

const segments = [
  { value: "a", label: "A", testID: "seg-a" },
  { value: "b", label: "B", testID: "seg-b" },
] as const;

function segmented(value: "a" | "b" | null, iconOnly = false, tabsLabel?: string) {
  const onChange = vi.fn();

  render(
    <Segmented
      iconOnly={iconOnly}
      tabsLabel={tabsLabel}
      segments={segments}
      testID="seg"
      value={value}
      onChange={onChange}
    />
  );

  return onChange;
}

describe("Segmented", () => {
  it("is a labelled tab list of tabs where it switches views", () => {
    segmented("a", false, "Content");

    expect(screen.getByRole("tablist").getAttribute("aria-label")).toBe("Content");
    expect(screen.getByRole("tablist")).toBe(screen.getByTestId("seg"));
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("marks the picked tab selected", () => {
    segmented("b", false, "Content");

    expect(screen.getByTestId("seg-a").getAttribute("aria-selected")).toBe("false");
    expect(screen.getByTestId("seg-b").getAttribute("aria-selected")).toBe("true");
  });

  it("is a radio group of radios, the picked one checked, where it picks a value", () => {
    segmented("b");

    expect(screen.getByRole("radiogroup")).toBe(screen.getByTestId("seg"));
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByTestId("seg-a").getAttribute("aria-checked")).toBe("false");
    expect(screen.getByTestId("seg-b").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("seg-b").getAttribute("aria-selected")).toBeNull();
  });

  it("fills the picked segment until the thumb is placed, so its first frame shows the pick", () => {
    segmented("b");

    expect(screen.getByTestId("seg-b").className).toContain("bg-thumb");
    expect(screen.getByTestId("seg-a").className).not.toContain("bg-thumb");
  });

  it("picks none for a null value", () => {
    segmented(null, false, "Content");

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
