import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { afterPlanningStep, plannedServings, useAfterPlanning } from "../after-planning";

const user = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("../../reader", () => ({ useReader: () => ({ user: user.current }) }));

function withChoice(afterPlanning?: string) {
  user.current = { preferences: afterPlanning ? { afterPlanning } : {} };
}

describe("afterPlanningStep", () => {
  it("asks for nothing, the panel, or the lines at once", () => {
    expect(afterPlanningStep("nothing", "r1")).toBeNull();
    expect(afterPlanningStep("openGroceries", "r1")).toEqual({
      recipeId: "r1",
      addAtOnce: false,
      open: true,
    });
    expect(afterPlanningStep("addGroceries", "r1")).toEqual({
      recipeId: "r1",
      addAtOnce: true,
      open: false,
    });
  });
});

describe("plannedServings", () => {
  it("is the recipe's own servings, one without any", () => {
    expect(plannedServings({ servings: 4 })).toBe(4);
    expect(plannedServings({ servings: 0 })).toBe(1);
    expect(plannedServings({ servings: null })).toBe(1);
    expect(plannedServings({})).toBe(1);
  });
});

describe("useAfterPlanning", () => {
  beforeEach(() => withChoice());

  it("opens the groceries panel by default, a new key each time", () => {
    const { result } = renderHook(() => useAfterPlanning());

    act(() => result.current.afterPlanning("r1"));
    expect(result.current.planned).toEqual({
      key: 1,
      recipeId: "r1",
      addAtOnce: false,
      open: true,
    });

    act(() => result.current.afterPlanning("r2"));
    expect(result.current.planned).toMatchObject({ key: 2, recipeId: "r2" });
  });

  it("adds at once without opening the panel", () => {
    withChoice("addGroceries");
    const { result } = renderHook(() => useAfterPlanning());

    act(() => result.current.afterPlanning("r1"));

    expect(result.current.planned).toMatchObject({ addAtOnce: true, open: false });
  });

  it("does nothing when the choice is nothing", () => {
    withChoice("nothing");
    const { result } = renderHook(() => useAfterPlanning());

    act(() => result.current.afterPlanning("r1"));

    expect(result.current.planned).toBeNull();
  });

  it("follows the panel opening and closing, and ignores it before anything is planned", () => {
    const { result } = renderHook(() => useAfterPlanning());

    act(() => result.current.setOpen(true));
    expect(result.current.planned).toBeNull();

    act(() => result.current.afterPlanning("r1"));
    act(() => result.current.setOpen(false));
    expect(result.current.planned).toMatchObject({ recipeId: "r1", open: false });
  });
});
