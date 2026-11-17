import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

import { plannedItemChanges, usePlannedItemDraft } from "../planned-item-draft";

const saveItem = vi.hoisted(() => vi.fn());

vi.mock("../use-calendar-mutations", () => ({ useCalendarMutations: () => ({ saveItem }) }));

const note: PlannedItemFromQuery = {
  id: "n1",
  userId: "u1",
  date: "2026-11-12",
  slot: "Lunch",
  sortOrder: 0,
  itemType: "note",
  recipeId: null,
  title: "Leftovers",
  recipeName: null,
  recipeImage: null,
  servings: null,
  calories: null,
  version: 1,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const recipe: PlannedItemFromQuery = {
  ...note,
  id: "r1",
  itemType: "recipe",
  recipeId: "rec",
  title: null,
  recipeName: "Soup",
};
const unchanged = (item: PlannedItemFromQuery) => ({
  title: item.title ?? "",
  date: item.date,
  slot: item.slot,
});

describe("plannedItemChanges", () => {
  it("is nothing when the draft is the item", () => {
    expect(plannedItemChanges(note, unchanged(note))).toBeNull();
    expect(plannedItemChanges(recipe, unchanged(recipe))).toBeNull();
  });

  it.each([
    ["the text", { title: " Leek soup " }, { title: "Leek soup" }],
    ["the day", { date: "2026-12-30" }, { move: { date: "2026-12-30", slot: "Lunch" } }],
    ["the slot", { slot: "Dinner" }, { move: { date: "2026-11-12", slot: "Dinner" } }],
    [
      "day and slot",
      { date: "2026-12-30", slot: "Dinner" },
      { move: { date: "2026-12-30", slot: "Dinner" } },
    ],
    [
      "all three",
      { title: "Leek soup", date: "2026-12-30", slot: "Dinner" },
      { title: "Leek soup", move: { date: "2026-12-30", slot: "Dinner" } },
    ],
  ] as const)("for a note with %s changed writes just that", (_, edit, expected) => {
    expect(plannedItemChanges(note, { ...unchanged(note), ...edit })).toEqual(expected);
  });

  it("treats text that only differs by spaces as unchanged", () => {
    expect(plannedItemChanges(note, { ...unchanged(note), title: "  Leftovers " })).toBeNull();
  });

  it("refuses a blank note, whatever else changed", () => {
    expect(
      plannedItemChanges(note, { ...unchanged(note), title: "  ", slot: "Dinner" })
    ).toBeNull();
  });

  it("never writes text for a recipe", () => {
    expect(plannedItemChanges(recipe, { ...unchanged(recipe), title: "x", slot: "Snack" })).toEqual(
      { move: { date: "2026-11-12", slot: "Snack" } }
    );
  });
});

describe("usePlannedItemDraft", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves date, slot and text as one write, and writes nothing before Save", () => {
    const { result } = renderHook(() => usePlannedItemDraft(note));

    act(() => {
      result.current.setTitle("Leek soup");
      result.current.setDate("2026-12-30");
      result.current.setSlot("Dinner");
    });

    expect(saveItem).not.toHaveBeenCalled();
    act(() => result.current.save());

    expect(saveItem).toHaveBeenCalledTimes(1);
    expect(saveItem).toHaveBeenCalledWith("n1", {
      title: "Leek soup",
      move: { date: "2026-12-30", slot: "Dinner" },
    });
  });

  it("has no changes, and saves nothing, until something differs", () => {
    const { result } = renderHook(() => usePlannedItemDraft(note));

    expect(result.current.changes).toBeNull();
    act(() => result.current.save());
    expect(saveItem).not.toHaveBeenCalled();

    act(() => result.current.setSlot("Dinner"));
    act(() => result.current.setSlot("Lunch"));

    expect(result.current.changes).toBeNull();
  });
});
