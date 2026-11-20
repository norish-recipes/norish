// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = {
  children?: ReactNode;
  className?: string;
  accessibilityLabel?: string;
  accessibilityState?: { disabled?: boolean };
  disabled?: boolean;
  testID?: string;
  onPress?: () => void;
};

vi.mock("react-native", () => ({
  Text: ({ children }: Props) => <span>{children}</span>,
  Pressable: ({ children, className, accessibilityLabel, disabled, testID, onPress }: Props) => (
    <button
      aria-label={accessibilityLabel}
      className={className}
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  ),
}));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: (name: string) => name }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));

const { IconButton } = await import("@/components/icon-button");
const { PillButton } = await import("@/components/pill-button");

describe("IconButton", () => {
  it("presses", () => {
    const onPress = vi.fn();

    render(<IconButton icon="add" label="Add" testID="b" onPress={onPress} />);
    fireEvent.click(screen.getByTestId("b"));

    expect(onPress).toHaveBeenCalledOnce();
  });

  it("is dimmed and gives no press while disabled", () => {
    const onPress = vi.fn();

    render(<IconButton disabled icon="add" label="Add" testID="b" onPress={onPress} />);
    fireEvent.click(screen.getByTestId("b"));

    expect(screen.getByTestId("b").className).toContain("opacity-40");
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("PillButton", () => {
  it("presses and shows its label", () => {
    const onPress = vi.fn();

    render(<PillButton label="Select all" testID="p" onPress={onPress} />);
    fireEvent.click(screen.getByTestId("p"));

    expect(screen.getByText("Select all")).toBeTruthy();
    expect(onPress).toHaveBeenCalledOnce();
  });
});
