// @vitest-environment jsdom
import { showGroceriesSection, useGroceriesSection } from "@/lib/groceries-section";
import { redirectLink } from "@/lib/redirect-link";
import { useMarkSheetOpen } from "@/lib/tab-bar-visibility";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dismissAll = vi.fn();

vi.mock("expo-router", () => ({
  router: { dismissAll: () => dismissAll() },
  useIsFocused: () => true,
  useNavigation: () => ({ addListener: () => () => {} }),
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

  it("opens a link to the Pantry on the Groceries page, already showing the Pantry", async () => {
    showGroceriesSection("list");
    const section = renderHook(() => useGroceriesSection());

    await expect(redirectLink({ path: "/groceries/pantry-add", initial: true })).resolves.toBe(
      "/groceries/pantry-add"
    );
    expect(section.result.current).toBe("list");

    await expect(redirectLink({ path: "norish://groceries/pantry", initial: true })).resolves.toBe(
      "/groceries"
    );
    expect(section.result.current).toBe("pantry");

    act(() => showGroceriesSection("list"));
    await expect(redirectLink({ path: "/groceries/pantry?x=1", initial: false })).resolves.toBe(
      "/groceries"
    );
    expect(section.result.current).toBe("pantry");
    section.unmount();
  });
});
