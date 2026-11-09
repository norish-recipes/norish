/**
 * A grouped row skips a group that changed only in what it doesn't draw: its
 * lines' sort order and version, which a create bumps for every line below it.
 */
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";
import { groupGroceriesByIngredient } from "@norish/shared/lib/grocery-grouping";

import { drawsTheSame, GroupedGroceryItem } from "./grouped-grocery-item";

const MILK: GroceryDto = {
  id: "milk",
  name: "milk",
  amount: 1,
  unit: "L",
  isDone: false,
  sortOrder: 3,
  version: 2,
  recipeIngredientId: null,
  recurringGroceryId: null,
  storeId: null,
};

const NO_RECURRING: RecurringGroceryDto[] = [];
const ON_TOGGLE = () => undefined;
const ON_EDIT = () => undefined;
const ON_TOGGLE_GROUP = () => undefined;

/** The row's props for milk as the list holds it after `change`. */
function propsWith(change: Partial<GroceryDto>): ComponentProps<typeof GroupedGroceryItem> {
  const [group] = groupGroceriesByIngredient([{ ...MILK, ...change }], () => null).get(null)!;

  return {
    group: group!,
    recurringGroceries: NO_RECURRING,
    onToggle: ON_TOGGLE,
    onEdit: ON_EDIT,
    onToggleGroup: ON_TOGGLE_GROUP,
  };
}

describe("drawsTheSame", () => {
  const before = propsWith({});

  it("skips a group whose lines moved down or were bumped a version", () => {
    expect(drawsTheSame(before, propsWith({ sortOrder: 4 }))).toBe(true);
    expect(drawsTheSame(before, propsWith({ version: 3 }))).toBe(true);
    expect(drawsTheSame(before, propsWith({ sortOrder: 4, version: 3 }))).toBe(true);
  });

  it("renders a group that was ticked, renamed or given another amount", () => {
    expect(drawsTheSame(before, propsWith({ isDone: true }))).toBe(false);
    expect(drawsTheSame(before, propsWith({ name: "oat milk" }))).toBe(false);
    expect(drawsTheSame(before, propsWith({ amount: 2 }))).toBe(false);
  });

  it("renders for any other prop that changed", () => {
    expect(drawsTheSame(before, { ...before, isLast: true })).toBe(false);
    expect(drawsTheSame(before, { ...before, onEdit: () => undefined })).toBe(false);
  });
});
