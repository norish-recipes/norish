// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = {
  children?: ReactNode;
  accessibilityState?: { checked?: boolean };
  testID?: string;
  onPress?: () => void;
};

vi.mock("react-native", () => ({
  View: ({ children }: Props) => <div>{children}</div>,
  Pressable: ({ children, accessibilityState, testID, onPress }: Props) => (
    <button aria-checked={accessibilityState?.checked} data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock("react-native-reanimated", () => import("./../mocks/reanimated"));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("heroui-native", () => ({ useThemeColor: () => ["warning", "muted"] }));

const { StarRating } = await import("@/components/star-rating");

function stars(value: number | null) {
  const onChange = vi.fn();

  render(<StarRating labelFor={String} testID="rate" value={value} onChange={onChange} />);

  return onChange;
}

describe("StarRating", () => {
  it("picks the tapped star", () => {
    const onChange = stars(null);

    fireEvent.click(screen.getByTestId("rate-4"));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("clears when the picked star is tapped again", () => {
    const onChange = stars(3);

    expect(screen.getByTestId("rate-3").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByTestId("rate-3"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("moves to another star without clearing", () => {
    const onChange = stars(3);

    fireEvent.click(screen.getByTestId("rate-2"));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
