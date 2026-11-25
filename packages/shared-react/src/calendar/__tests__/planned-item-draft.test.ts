import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

import { plannedItemChanges, usePlannedItemDraft } from "../planned-item-draft";

const saveItem = vi.hoisted(() => vi.fn());

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
    ["the day", { date: "2026-12-30" }, { date: "2026-12-30" }],
    ["the slot", { slot: "Dinner" }, { slot: "Dinner" }],
    [
      "day and slot",
      { date: "2026-12-30", slot: "Dinner" },
      { date: "2026-12-30", slot: "Dinner" },
    ],
    [
      "all three",
      { title: "Leek soup", date: "2026-12-30", slot: "Dinner" },
      { title: "Leek soup", date: "2026-12-30", slot: "Dinner" },
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

  it("never writes text for a recipe out of view, which shows by its title alone", () => {
    const outOfView = { ...recipe, recipeId: null };

    expect(
      plannedItemChanges(outOfView, { ...unchanged(outOfView), title: "A note now" })
    ).toBeNull();
  });

  it("never writes text for a recipe", () => {
    expect(plannedItemChanges(recipe, { ...unchanged(recipe), title: "x", slot: "Snack" })).toEqual(
      { slot: "Snack" }
    );
  });
});

describe("usePlannedItemDraft", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves date, slot and text as one write, and writes nothing before Save", () => {
    const { result } = renderHook(() => usePlannedItemDraft(note, saveItem));

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
      date: "2026-12-30",
      slot: "Dinner",
    });
  });

  it("has no changes, and saves nothing, until something differs", () => {
    const { result } = renderHook(() => usePlannedItemDraft(note, saveItem));

    expect(result.current.changes).toBeNull();
    act(() => result.current.save());
    expect(saveItem).not.toHaveBeenCalled();

    act(() => result.current.setSlot("Dinner"));
    act(() => result.current.setSlot("Lunch"));

    expect(result.current.changes).toBeNull();
  });
});

describe("a draft while a housemate writes the item", () => {
  beforeEach(() => vi.clearAllMocks());

  const moved = { ...note, date: "2026-11-14", slot: "Dinner" as const, version: 2 };
  const draftOf = () =>
    renderHook(({ item }) => usePlannedItemDraft(item, saveItem), { initialProps: { item: note } });

  it("untouched: shows their values and has nothing to save", () => {
    const { result, rerender } = draftOf();

    rerender({ item: { ...moved, title: "Pea soup" } });

    expect(result.current.draft).toEqual({ title: "Pea soup", date: "2026-11-14", slot: "Dinner" });
    expect(result.current.changes).toBeNull();
    act(() => result.current.save());
    expect(saveItem).not.toHaveBeenCalled();
  });

  it("a touched note saves only the note, over their move", () => {
    const { result, rerender } = draftOf();

    act(() => result.current.setTitle("Leek soup"));
    rerender({ item: moved });

    expect(result.current.draft).toEqual({
      title: "Leek soup",
      date: "2026-11-14",
      slot: "Dinner",
    });
    act(() => result.current.save());
    expect(saveItem).toHaveBeenCalledExactlyOnceWith("n1", { title: "Leek soup" });
  });

  it("a touched day they also chose has nothing to save", () => {
    const { result, rerender } = draftOf();

    act(() => result.current.setDate("2026-11-14"));
    rerender({ item: moved });

    expect(result.current.changes).toBeNull();
  });

  it("Save tapped twice sends one write, and only the first says it wrote", () => {
    const { result } = draftOf();

    act(() => result.current.setSlot("Dinner"));
    const { save } = result.current;
    const wrote: boolean[] = [];

    act(() => {
      wrote.push(save(), save());
    });
    act(() => {
      wrote.push(result.current.save());
    });

    expect(wrote).toEqual([true, false, false]);
    expect(saveItem).toHaveBeenCalledExactlyOnceWith("n1", { slot: "Dinner" });
  });
});
