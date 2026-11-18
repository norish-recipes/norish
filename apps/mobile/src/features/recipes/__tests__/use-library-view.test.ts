// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const device = vi.hoisted(() => ({ saved: "grid", save: vi.fn() }));

vi.mock("@norish/shared-react/reader", () => ({
  useDevicePreference: () => [device.saved, device.save],
}));

const { useLibraryView } = await import("@/features/recipes/hooks/use-library-view");

describe("useLibraryView", () => {
  it("shows the saved view until a pick, then the pick at once while the save is on its way", () => {
    const { result } = renderHook(() => useLibraryView());

    expect(result.current[0]).toBe("grid");

    act(() => result.current[1]("list"));
    expect(result.current[0]).toBe("list");
    expect(device.save).toHaveBeenCalledWith("list");
  });

  it("keeps the pick when the save fails and the saved view reads back the old one", () => {
    const { result, rerender } = renderHook(() => useLibraryView());

    act(() => result.current[1]("list"));
    device.saved = "grid";
    rerender();

    expect(result.current[0]).toBe("list");
  });

  it("flips every reader of the view together", () => {
    const first = renderHook(() => useLibraryView());
    const second = renderHook(() => useLibraryView());

    act(() => first.result.current[1]("grid"));

    expect(second.result.current[0]).toBe("grid");
  });
});
