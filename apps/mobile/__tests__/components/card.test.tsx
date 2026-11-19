// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = { children?: ReactNode; className?: string; testID?: string; onPress?: () => void };

vi.mock("react-native", () => ({
  View: ({ children, className, testID }: Props) => (
    <div className={className} data-testid={testID}>
      {children}
    </div>
  ),
  Text: ({ children }: Props) => <span>{children}</span>,
  Pressable: ({ children, testID, onPress }: Props) => (
    <button data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: () => <i data-testid="chevron" />,
}));
vi.mock("heroui-native", () => ({ useThemeColor: (names: string[]) => names }));

const { CardRow } = await import("@/components/card");

describe("CardRow", () => {
  it("opens a choice with a chevron when it is pressable", () => {
    const onPress = vi.fn();

    render(<CardRow label="Store" testID="r" value="Albert Heijn" onPress={onPress} />);
    fireEvent.click(screen.getByTestId("r"));

    expect(onPress).toHaveBeenCalledOnce();
    expect(screen.getByText("Albert Heijn")).toBeTruthy();
    expect(screen.getByTestId("chevron")).toBeTruthy();
  });

  it("holds its end control without a chevron when it is not pressable", () => {
    render(
      <CardRow first label="We keep this" testID="r">
        <span>switch</span>
      </CardRow>
    );

    expect(screen.getByText("switch")).toBeTruthy();
    expect(screen.queryByTestId("chevron")).toBeNull();
    expect(screen.getByTestId("r").className).not.toContain("border-t");
  });
});
