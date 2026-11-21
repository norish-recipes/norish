// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Text: () => null,
  Pressable: ({ testID, onPress }: { testID?: string; onPress: () => void }) => (
    <button data-testid={testID} type="button" onClick={onPress} />
  ),
}));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("heroui-native", () => {
  const Slot = ({ children }: { children?: ReactNode }) => <>{children}</>;

  return {
    Input: () => null,
    TextArea: () => null,
    useThemeColor: () => ["gray"],
    InputGroup: Object.assign(Slot, { Prefix: Slot, Suffix: Slot, Input: () => null }),
  };
});

const { SheetInput } = await import("@/components/sheet-input");

describe("SheetInput clear", () => {
  it("shows the clear circle while the field holds a value, and clears on press", () => {
    const onClear = vi.fn();

    render(<SheetInput testID="field" value="soup" onClear={onClear} />);
    fireEvent.click(screen.getByTestId("field-clear"));

    expect(onClear).toHaveBeenCalledOnce();
  });

  it("has no clear circle when the field is empty", () => {
    render(<SheetInput testID="field" value="" onClear={vi.fn()} />);

    expect(screen.queryByTestId("field-clear")).toBeNull();
  });
});
