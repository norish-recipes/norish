import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSlotPlanning } from "../use-slot-planning";

const planRecipe = vi.hoisted(() => vi.fn());
const planNote = vi.hoisted(() => vi.fn());

vi.mock("../use-calendar-mutations", () => ({
  useCalendarMutations: () => ({ planRecipe, planNote }),
}));

const DATE = new Date(2026, 10, 13);
const close = vi.fn();
const onPlanned = vi.fn();
const getRandomRecipe = vi.fn();

function planning(slot?: "Lunch") {
  return renderHook(() => useSlotPlanning({ date: DATE, slot, getRandomRecipe, close, onPlanned }));
}

describe("useSlotPlanning", () => {
  beforeEach(() => vi.clearAllMocks());

  it("plans a picked recipe on the day, closes, then reports it", () => {
    const calls: string[] = [];

    planRecipe.mockImplementation(() => calls.push("plan"));
    close.mockImplementation(() => calls.push("close"));
    onPlanned.mockImplementation(() => calls.push("planned"));

    planning().result.current.planRecipe({ id: "r1" }, "Dinner");

    expect(planRecipe).toHaveBeenCalledWith("2026-11-13", "Dinner", "r1");
    expect(onPlanned).toHaveBeenCalledWith("r1");
    expect(calls).toEqual(["plan", "close", "planned"]);
  });

  it("plans a random recipe from the slot's category, with the flag up meanwhile", async () => {
    let resolve: (value: { id: string }) => void = () => {};

    getRandomRecipe.mockReturnValue(new Promise((done) => (resolve = done)));
    const { result } = planning("Lunch");
    let pending: Promise<void> = Promise.resolve();

    act(() => {
      pending = result.current.planRandom();
    });
    expect(result.current.isRandomLoading).toBe(true);
    expect(getRandomRecipe).toHaveBeenCalledWith("Lunch");

    await act(async () => {
      resolve({ id: "r2" });
      await pending;
    });

    expect(planRecipe).toHaveBeenCalledWith("2026-11-13", "Lunch", "r2");
    expect(close).toHaveBeenCalled();
    expect(result.current.isRandomLoading).toBe(false);
  });

  it("plans nothing for a random pick without a slot or without a recipe", async () => {
    await planning().result.current.planRandom();
    expect(getRandomRecipe).not.toHaveBeenCalled();

    getRandomRecipe.mockResolvedValue(null);
    await planning("Lunch").result.current.planRandom();
    expect(planRecipe).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("plans a trimmed note for the slot or a chosen one, and ignores blank text", () => {
    planning("Lunch").result.current.planNote("  Leftovers ");
    expect(planNote).toHaveBeenCalledWith("2026-11-13", "Lunch", "Leftovers");
    expect(close).toHaveBeenCalledTimes(1);

    planning().result.current.planNote("Eat out", "Dinner");
    expect(planNote).toHaveBeenLastCalledWith("2026-11-13", "Dinner", "Eat out");

    planning("Lunch").result.current.planNote("   ");
    planning().result.current.planNote("No slot");
    expect(planNote).toHaveBeenCalledTimes(2);
  });
});
