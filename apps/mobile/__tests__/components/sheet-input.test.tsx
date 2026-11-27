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
const mounts = vi.hoisted(() => ({ count: 0 }));

vi.mock("heroui-native", async () => {
  const { useEffect } = await import("react");
  const Slot = ({ children }: { children?: ReactNode }) => <>{children}</>;
  // Counts mounts, as a remounted field drops the keyboard.
  const Field = () => {
    useEffect(() => {
      mounts.count += 1;
    }, []);

    return null;
  };

  return {
    Input: Field,
    TextArea: () => null,
    useThemeColor: () => ["gray"],
    InputGroup: Object.assign(Slot, { Prefix: Slot, Suffix: Slot, Input: Field }),
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

  it("keeps the one field mounted as the clear circle comes and goes", () => {
    mounts.count = 0;
    const { rerender } = render(<SheetInput testID="field" value="" onClear={vi.fn()} />);

    rerender(<SheetInput testID="field" value="s" onClear={vi.fn()} />);
    rerender(<SheetInput testID="field" value="" onClear={vi.fn()} />);

    expect(mounts.count).toBe(1);
  });
});
