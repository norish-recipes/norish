// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = { children?: ReactNode; testID?: string; onPress?: () => void };

vi.mock("react-native", () => ({
  View: ({ children, testID }: Props) => <div data-testid={testID}>{children}</div>,
  Text: ({ children }: Props) => <span>{children}</span>,
  Pressable: ({ children, testID, onPress }: Props) => (
    <button data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />,
}));
vi.mock("heroui-native", () => ({ Skeleton: () => null }));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: () => undefined }));
vi.mock("@/components/card-slice", () => ({ CardSlice: ({ children }: Props) => children }));
vi.mock("@/components/native-menu", () => ({ NativeMenu: ({ children }: Props) => children }));
vi.mock("@/components/on-sheet", () => ({ useOnSheet: () => false }));

const { CountRow } = await import("@/components/count-row");

describe("CountRow's end", () => {
  it("marks a row that opens with a chevron, before a trailing control", () => {
    render(
      <CountRow name="soy" testID="row" trailing={<i data-testid="end" />} onPress={vi.fn()} />
    );

    const chevron = screen.getByTestId("icon-chevron-forward");

    expect(
      chevron.compareDocumentPosition(screen.getByTestId("end")) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("gives a row that does not open no chevron", () => {
    render(<CountRow name="soy" testID="row" trailing={<i data-testid="end" />} />);
    expect(screen.queryByTestId("icon-chevron-forward")).toBeNull();
  });

  it("marks a read-only row with the lock, not a chevron", () => {
    render(<CountRow lockLabel="Read-only" name="Italian" onPress={vi.fn()} />);
    expect(screen.getByTestId("icon-lock-closed-outline")).toBeTruthy();
    expect(screen.queryByTestId("icon-chevron-forward")).toBeNull();
  });
});
