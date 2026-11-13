import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePlanOnDay } from "../use-plan-on-day";

const planRecipe = vi.hoisted(() => vi.fn());

vi.mock("../use-calendar-mutations", () => ({ useCalendarMutations: () => ({ planRecipe }) }));

const close = vi.fn();
const onPlanned = vi.fn();

describe("usePlanOnDay", () => {
  beforeEach(() => vi.clearAllMocks());

  it("plans the recipe on the slot, closes, then reports it", () => {
    const calls: string[] = [];

    planRecipe.mockImplementation(() => calls.push("plan"));
    close.mockImplementation(() => calls.push("close"));
    onPlanned.mockImplementation(() => calls.push("planned"));

    const { result } = renderHook(() => usePlanOnDay({ recipe: { id: "r1" }, close, onPlanned }));

    result.current("2026-11-14", "Lunch");

    expect(planRecipe).toHaveBeenCalledWith("2026-11-14", "Lunch", "r1");
    expect(close).toHaveBeenCalledWith("r1");
    expect(onPlanned).toHaveBeenCalledWith("r1");
    expect(calls).toEqual(["plan", "close", "planned"]);
  });

  it("plans nothing until the recipe has loaded", () => {
    const { result } = renderHook(() => usePlanOnDay({ recipe: undefined, close, onPlanned }));

    result.current("2026-11-14", "Lunch");

    expect(planRecipe).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(onPlanned).not.toHaveBeenCalled();
  });
});
