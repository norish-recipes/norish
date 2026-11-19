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
    <button
      aria-label={accessibilityLabel}
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  ),
}));
vi.mock("@/lib/haptics", () => ({ lightImpact: () => lightImpact() }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: (name: string) => name }));

const { Stepper } = await import("@/components/stepper");

function stepper(props: { canDecrement?: boolean; canIncrement?: boolean }) {
  const onDecrement = vi.fn();
  const onIncrement = vi.fn();

  render(
    <Stepper
      decreaseLabel="Fewer"
      increaseLabel="More"
      testID="s"
      onDecrement={onDecrement}
      onIncrement={onIncrement}
      {...props}
    >
      <span>1</span>
    </Stepper>
  );

  return { onDecrement, onIncrement };
}

describe("Stepper", () => {
  beforeEach(() => lightImpact.mockClear());

  it("steps with a haptic", () => {
    const { onDecrement, onIncrement } = stepper({});

    fireEvent.click(screen.getByLabelText("Fewer"));
    fireEvent.click(screen.getByLabelText("More"));

    expect(onDecrement).toHaveBeenCalledOnce();
    expect(onIncrement).toHaveBeenCalledOnce();
    expect(lightImpact).toHaveBeenCalledTimes(2);
  });

  it("shows a knob that cannot move disabled, with no step and no haptic", () => {
    const { onIncrement } = stepper({ canIncrement: false });
    const plus = screen.getByLabelText<HTMLButtonElement>("More");

    fireEvent.click(plus);

    expect(plus.disabled).toBe(true);
    expect(onIncrement).not.toHaveBeenCalled();
    expect(lightImpact).not.toHaveBeenCalled();
  });

  it("prefixes the knobs' testIDs", () => {
    stepper({});

    expect(screen.getByTestId("s-decrease")).toBeTruthy();
    expect(screen.getByTestId("s-increase")).toBeTruthy();
  });
});
