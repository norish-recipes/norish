// @vitest-environment jsdom
import type { ReactNode, Ref } from "react";
import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const strip = vi.hoisted(() => ({ scrollTo: vi.fn(), offsets: [] as number[] }));

vi.mock("react-native", async () => (await import("../mocks/plan-sheet")).reactNative);
vi.mock("@expo/ui/swift-ui", async () => (await import("../mocks/plan-sheet")).swiftUi);
vi.mock(
  "@expo/ui/swift-ui/modifiers",
  async () => (await import("../mocks/plan-sheet")).swiftUiModifiers
);
vi.mock("react-intl", async () => (await import("../mocks/plan-sheet")).reactIntl);
vi.mock("@/hooks/use-accent-text-color", () => ({ useAccentTextColor: () => null }));
vi.mock("@norish/shared-react/reader", () => ({ useToday: () => "2026-11-12" }));
// A strip that hands its ref a `scrollTo` and records the offset it opens at.
vi.mock("@/components/sheet", () => ({
  SheetStrip: ({
    ref,
    contentOffset,
    children,
  }: {
    ref?: Ref<{ scrollTo: typeof strip.scrollTo }>;
    contentOffset: { x: number };
    children?: ReactNode;
  }) => {
    strip.offsets.push(contentOffset.x);
    React.useImperativeHandle(ref, () => ({ scrollTo: strip.scrollTo }));

    return <div>{children}</div>;
  },
}));

const { DayStrip } = await import("@/components/day-strip");

// Chip 52 + gap 8, and the strip leaves one chip's width before the picked day.
const offsetOf = (index: number) => index * 60 - 52;

describe("DayStrip", () => {
  beforeEach(() => {
    strip.scrollTo.mockClear();
    strip.offsets = [];
  });

  it("scrolls to a later picked day, whichever control picked it", () => {
    const { rerender } = render(<DayStrip date="2026-11-13" testID="s" onChange={() => {}} />);
    strip.scrollTo.mockClear();
    rerender(<DayStrip date="2026-11-16" testID="s" onChange={() => {}} />);

    expect(strip.scrollTo).toHaveBeenCalledExactlyOnceWith({ x: offsetOf(4), animated: true });
  });

  it("leaves the strip be for a day past it", () => {
    const { rerender } = render(<DayStrip date="2026-11-13" testID="s" onChange={() => {}} />);
    strip.scrollTo.mockClear();
    rerender(<DayStrip date="2027-03-01" testID="s" onChange={() => {}} />);

    expect(strip.scrollTo).not.toHaveBeenCalled();
  });

  it("opens at the first picked day's offset and keeps that opening offset", () => {
    const { rerender } = render(<DayStrip date="2026-11-13" testID="s" onChange={() => {}} />);
    rerender(<DayStrip date="2026-11-16" testID="s" onChange={() => {}} />);

    expect(new Set(strip.offsets)).toEqual(new Set([offsetOf(1)]));
  });
});
