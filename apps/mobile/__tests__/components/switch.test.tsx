// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = {
  children?: ReactNode;
  accessibilityLabel?: string;
  accessibilityState?: { checked?: boolean };
  testID?: string;
  onPress?: () => void;
};

vi.mock("react-native", () => ({
  View: () => null,
  Pressable: ({ accessibilityLabel, accessibilityState, testID, onPress }: Props) => (
    <button
      aria-checked={accessibilityState?.checked}
      aria-label={accessibilityLabel}
      data-testid={testID}
      role="switch"
      onClick={onPress}
    />
  ),
}));
vi.mock("@/lib/haptics", () => ({ lightImpact: () => {} }));

const { Switch } = await import("@/components/switch");

function toggle(isSelected: boolean) {
  const onSelectedChange = vi.fn();

  render(
    <Switch
      accessibilityLabel="Add another"
      isSelected={isSelected}
      testID="sw"
      onSelectedChange={onSelectedChange}
    />
  );

  return onSelectedChange;
}

describe("Switch", () => {
  it("turns on from off", () => {
    const onSelectedChange = toggle(false);

    fireEvent.click(screen.getByTestId("sw"));

    expect(onSelectedChange).toHaveBeenCalledWith(true);
  });

  it("turns off from on and says it is checked", () => {
    const onSelectedChange = toggle(true);

    expect(screen.getByTestId("sw").getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByTestId("sw"));

    expect(onSelectedChange).toHaveBeenCalledWith(false);
  });
});
