import { useLeavingEndsOnUnmount, useRecipeLeaving } from "@/components/dashboard/recipe-leaving";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("the bulk delete's leaving cards", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stop playing when the page leaves, and the delete still goes out", () => {
    vi.useFakeTimers();
    const page = renderHook(() => useLeavingEndsOnUnmount());
    const sendDelete = vi.fn();

    useRecipeLeaving.getState().playLeaving(["r1", "r2"], sendDelete);
    expect([...useRecipeLeaving.getState().leaving]).toEqual(["r1", "r2"]);

    // A cookbook opened mid-animation draws member cards with those ids.
    page.unmount();
    expect(useRecipeLeaving.getState().leaving.size).toBe(0);

    vi.advanceTimersByTime(500);
    expect(sendDelete).toHaveBeenCalledTimes(1);
  });
});
