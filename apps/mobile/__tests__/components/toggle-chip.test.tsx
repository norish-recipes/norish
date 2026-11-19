// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = {
  children?: ReactNode;
  className?: string;
  accessibilityState?: { selected?: boolean };
  testID?: string;
  onPress?: () => void;
};

vi.mock("react-native", () => ({ Text: ({ children }: Props) => <span>{children}</span> }));
vi.mock("@/components/pressable-scale", () => ({
  PressableScale: ({ children, className, accessibilityState, testID, onPress }: Props) => (
    <button
      aria-selected={accessibilityState?.selected}
      className={className}
      data-testid={testID}
      onClick={onPress}
    >
      {children}
    </button>
  ),
}));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: (name: string) => name }));

const { ToggleChip } = await import("@/components/toggle-chip");

describe("ToggleChip", () => {
  it("is sand while off and accent while on", () => {
    const { rerender } = render(
      <ToggleChip active={false} label="Lunch" testID="c" onPress={() => {}} />
    );

    expect(screen.getByTestId("c").className).toContain("bg-sand");

    rerender(<ToggleChip active label="Lunch" testID="c" onPress={() => {}} />);

    expect(screen.getByTestId("c").className).toContain("bg-accent");
    expect(screen.getByTestId("c").getAttribute("aria-selected")).toBe("true");
  });

  it("reports a press", () => {
    const onPress = vi.fn();

    render(<ToggleChip active={false} label="Lunch" testID="c" onPress={onPress} />);
    fireEvent.click(screen.getByTestId("c"));

    expect(onPress).toHaveBeenCalledOnce();
  });
});
