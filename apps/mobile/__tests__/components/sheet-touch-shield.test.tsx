// @vitest-environment jsdom
import React from "react";
import { SheetTouchShield } from "@/components/sheet-touch-shield";
import { openAfterSheet, useSheetExit, useSheetPresenting } from "@/lib/after-sheet";
import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    StyleSheet: { absoluteFill: {} },
    View: ({ testID }: { testID?: string }) => createElement("div", { "data-testid": testID }),
  };
});

describe("SheetTouchShield", () => {
  it("covers the screen only while a sheet's queued open waits", () => {
    const stack = renderHook(() => useSheetExit());
    const sheet = renderHook(() => useSheetPresenting());

    render(<SheetTouchShield />);
    expect(screen.queryByTestId("sheet-touch-shield")).toBeNull();

    act(() => stack.result.current());
    act(() => void openAfterSheet(sheet.result.current, vi.fn(), vi.fn()));
    expect(screen.getByTestId("sheet-touch-shield")).toBeTruthy();

    sheet.unmount();
    act(() => stack.result.current());
    expect(screen.queryByTestId("sheet-touch-shield")).toBeNull();
    stack.unmount();
  });
});
