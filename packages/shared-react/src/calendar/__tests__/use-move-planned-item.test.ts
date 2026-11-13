import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

import { moveTargetIndex, useMovePlannedItem } from "../use-move-planned-item";

const moveItem = vi.hoisted(() => vi.fn());

vi.mock("../use-calendar-mutations", () => ({ useCalendarMutations: () => ({ moveItem }) }));

function planned(id: string, date: string, slot: PlannedItemFromQuery["slot"]) {
  return {
    id,
    userId: "u",
    date,
    slot,
    sortOrder: 0,
    itemType: "recipe",
    recipeId: "r",
    title: null,
    recipeName: id,
    recipeImage: null,
    servings: null,
    calories: null,
    version: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  } satisfies PlannedItemFromQuery;
}

const moved = planned("m", "2026-11-13", "Lunch");
const items = [moved, planned("a", "2026-11-14", "Dinner"), planned("b", "2026-11-14", "Dinner")];
const close = vi.fn();

describe("moveTargetIndex", () => {
  it("is the end of the target slot, the moved item not counted", () => {
    expect(moveTargetIndex(items, moved, "2026-11-14", "Dinner")).toBe(2);
    expect(moveTargetIndex(items, moved, "2026-11-14", "Lunch")).toBe(0);
    expect(moveTargetIndex(items, items[1]!, "2026-11-14", "Dinner")).toBe(1);
  });
});

describe("useMovePlannedItem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("moves the item to the end of the slot and closes", () => {
    const { result } = renderHook(() => useMovePlannedItem({ item: moved, items, close }));

    result.current("2026-11-14", "Dinner");

    expect(moveItem).toHaveBeenCalledWith("m", "2026-11-14", "Dinner", 2);
    expect(close).toHaveBeenCalled();
  });

  it("only closes when the item is already there", () => {
    const { result } = renderHook(() => useMovePlannedItem({ item: moved, items, close }));

    result.current("2026-11-13", "Lunch");

    expect(moveItem).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it("does nothing without the item", () => {
    const { result } = renderHook(() => useMovePlannedItem({ item: undefined, items, close }));

    result.current("2026-11-14", "Dinner");

    expect(moveItem).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
