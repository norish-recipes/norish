// @vitest-environment jsdom
import { redirectLink } from "@/lib/redirect-link";
import { useMarkSheetOpen } from "@/lib/tab-bar-visibility";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dismissAll = vi.fn();

vi.mock("expo-router", () => ({
  router: { dismissAll: () => dismissAll() },
  useIsFocused: () => true,
}));

describe("redirectLink", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dismissAll.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("dismisses an open sheet before the link navigates", async () => {
    const sheet = renderHook(() => useMarkSheetOpen());
    const result = redirectLink({ path: "/recipe/b", initial: false });

    expect(dismissAll).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe("/recipe/b");
    sheet.unmount();
  });

  it("leaves a link alone with no sheet open, and the first link of a launch", async () => {
    await expect(redirectLink({ path: "/recipe/b", initial: false })).resolves.toBe("/recipe/b");

    const sheet = renderHook(() => useMarkSheetOpen());

    await expect(redirectLink({ path: "/recipe/b", initial: true })).resolves.toBe("/recipe/b");
    expect(dismissAll).not.toHaveBeenCalled();
    sheet.unmount();
  });
});
