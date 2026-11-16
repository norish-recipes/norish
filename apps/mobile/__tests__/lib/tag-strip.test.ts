// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native-gesture-handler", () => ({
  GestureDetector: ({ children }: { children?: unknown }) => children,
  GestureStateManager: { activate: () => {}, fail: () => {} },
  usePanGesture: () => ({}),
}));
vi.mock("react-native-reanimated", async () => ({
  ...(await import("../mocks/reanimated")),
  scrollTo: () => {},
}));

const { useTagStrip } = await import("@/features/recipes/components/tag-strip");

describe("useTagStrip", () => {
  it("measures the scrollable extent whichever of width and content size arrives first", () => {
    const { result } = renderHook(() => useTagStrip());

    result.current.setContentWidth(300);
    result.current.setWidth(100);
    expect(result.current.max.get()).toBe(200);

    result.current.setWidth(150);
    expect(result.current.max.get()).toBe(150);

    result.current.setContentWidth(120);
    expect(result.current.max.get()).toBe(0);
  });
});
