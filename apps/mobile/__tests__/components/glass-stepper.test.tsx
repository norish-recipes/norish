// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Props = {
  children?: ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
  onPress?: () => void;
};
const host = ({ children }: Props) => <span>{children}</span>;
const lightImpact = vi.fn();

vi.mock("react-native", () => ({
  View: host,
  Pressable: ({ children, accessibilityLabel, disabled, testID, onPress }: Props) => (
    <button aria-label={accessibilityLabel} data-testid={testID} disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/glass", () => ({ GlassSurface: () => null }));
vi.mock("@/lib/haptics", () => ({ lightImpact: () => lightImpact() }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("heroui-native", () => ({ useThemeColor: (names: string[]) => names }));

const { GlassStepper } = await import("@/components/glass-stepper");

function stepper(props: { canDecrement?: boolean; canIncrement?: boolean }) {
  const onDecrement = vi.fn();
  const onIncrement = vi.fn();

  render(
    <GlassStepper
      decreaseLabel="Fewer"
      increaseLabel="More"
      testID="s"
      onDecrement={onDecrement}
      onIncrement={onIncrement}
      {...props}
    >
      <span>1</span>
    </GlassStepper>
  );

  return { onDecrement, onIncrement };
}

describe("GlassStepper", () => {
  beforeEach(() => lightImpact.mockClear());

  it("steps with a haptic", () => {
    const { onDecrement, onIncrement } = stepper({});

    fireEvent.click(screen.getByLabelText("Fewer"));
    fireEvent.click(screen.getByLabelText("More"));

    expect(onDecrement).toHaveBeenCalledOnce();
    expect(onIncrement).toHaveBeenCalledOnce();
    expect(lightImpact).toHaveBeenCalledTimes(2);
  });

  it("shows a step that cannot move disabled, with no step and no haptic", () => {
    const { onDecrement } = stepper({ canDecrement: false });
    const minus = screen.getByLabelText<HTMLButtonElement>("Fewer");

    fireEvent.click(minus);

    expect(minus.disabled).toBe(true);
    expect(onDecrement).not.toHaveBeenCalled();
    expect(lightImpact).not.toHaveBeenCalled();
  });
});
