// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Props = { children?: ReactNode };

const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));

vi.mock("react-native", () => ({
  ScrollView: ({ children }: Props) => <div>{children}</div>,
  View: ({ children }: Props) => <div>{children}</div>,
  useWindowDimensions: () => ({ height: 800 }),
}));
vi.mock("expo-router", () => ({ useRouter: () => router }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@/components/sheet", () => ({ Sheet: ({ children }: Props) => <div>{children}</div> }));
vi.mock("../components/timer-list", () => ({
  AllTimers: ({ onOpen }: { onOpen: (timer: { recipeId: string; stepIndex: number }) => void }) => (
    <button type="button" onClick={() => onOpen({ recipeId: "r", stepIndex: 2 })}>
      row
    </button>
  ),
}));

const { TimersSheetScreen } = await import("../screens/timers-sheet-screen");
const { useSheetExit } = await import("@/lib/after-sheet");

describe("TimersSheetScreen", () => {
  beforeEach(() => {
    router.back.mockClear();
    router.push.mockClear();
  });

  it("closes the sheet once for a double tap and opens cook mode once, when the sheet has gone", () => {
    const stack = renderHook(() => useSheetExit());

    render(<TimersSheetScreen />);
    fireEvent.click(screen.getByText("row"));
    fireEvent.click(screen.getByText("row"));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();

    act(() => stack.result.current());
    act(() => stack.result.current());

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: expect.any(String),
      params: { id: "r", step: "2" },
    });
    stack.unmount();
  });

  it("opens nothing when the stack goes before the sheet has", () => {
    const stack = renderHook(() => useSheetExit());

    render(<TimersSheetScreen />);
    fireEvent.click(screen.getByText("row"));
    const finish = stack.result.current;

    stack.unmount();
    finish();

    expect(router.push).not.toHaveBeenCalled();
  });
});
