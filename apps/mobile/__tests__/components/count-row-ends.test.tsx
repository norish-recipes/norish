// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Props = {
  children?: ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  onPress?: () => void;
};

vi.mock("react-native", () => ({
  View: ({ children, testID }: Props) => <div data-testid={testID}>{children}</div>,
  Text: ({ children }: Props) => <span>{children}</span>,
  Pressable: ({ children, testID, accessibilityLabel, onPress }: Props) => (
    <button aria-label={accessibilityLabel} data-testid={testID} onClick={onPress}>
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
vi.mock("@/components/native-menu", () => ({
  NativeMenu: ({ children, fill }: Props & { fill?: boolean }) => (
    <div data-fill={fill ? "true" : undefined} data-testid="menu">
      {children}
    </div>
  ),
}));
vi.mock("@/components/pill", () => ({ Pill: ({ children }: Props) => <b>{children}</b> }));
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

  it("keeps a trailing control out of the row's own button, so each takes its own press", () => {
    render(
      <CountRow name="soy" testID="row" trailing={<i data-testid="end" />} onPress={vi.fn()} />
    );
    expect(screen.getByTestId("row").contains(screen.getByTestId("end"))).toBe(false);
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

  it("lets a row with a long-press menu fill the row, so its name keeps its width", () => {
    render(
      <CountRow
        count="4"
        menu={[{ key: "rename", label: "Rename", onPress: vi.fn() }]}
        name="dinner"
        testID="row"
        onPress={vi.fn()}
      />
    );
    expect(screen.getByTestId("menu").dataset.fill).toBe("true");
  });

  it("speaks a row as its non-empty parts, without a stray separator", () => {
    render(
      <CountRow
        count="4"
        countLabel="4 recipes"
        name="basil"
        tag=""
        testID="row"
        onPress={vi.fn()}
      />
    );
    expect(screen.getByTestId("row").getAttribute("aria-label")).toBe("basil, 4 recipes");
  });
});
