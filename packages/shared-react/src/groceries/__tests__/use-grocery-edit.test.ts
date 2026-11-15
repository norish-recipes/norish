import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";

import { useGroceryEdit } from "../use-grocery-edit";

const mutations = vi.hoisted(() => ({
  deleteGroceries: vi.fn(),
  createRecurringGrocery: vi.fn(),
  updateGrocery: vi.fn(),
  updateRecurringGrocery: vi.fn(),
  deleteRecurringGrocery: vi.fn(),
}));

vi.mock("../use-groceries-mutations", () => ({ useGroceriesMutations: () => mutations }));

const grocery = { id: "g1", storeId: "s1" } as unknown as GroceryDto;
const recurring = { id: "r1" } as unknown as RecurringGroceryDto;
const weekly = { rule: "week", interval: 1, weekday: 1 } as const;

describe("useGroceryEdit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a plain grocery", () => {
    renderHook(() => useGroceryEdit(grocery, null)).result.current.save("milk", null, "s2", 3);

    expect(mutations.updateGrocery).toHaveBeenCalledExactlyOnceWith("g1", "milk", "s2", 3);
  });

  it("turns a plain grocery that gains a repeat into a repeating one, keeping its Store", () => {
    renderHook(() => useGroceryEdit(grocery, null)).result.current.save("milk", weekly);

    expect(mutations.createRecurringGrocery).toHaveBeenCalledExactlyOnceWith(
      "milk",
      weekly,
      "s1",
      undefined
    );
    expect(mutations.deleteGroceries).toHaveBeenCalledExactlyOnceWith(["g1"]);
  });

  it("updates the repeat of a repeating grocery", () => {
    renderHook(() => useGroceryEdit(grocery, recurring)).result.current.save("milk", weekly);

    expect(mutations.updateRecurringGrocery).toHaveBeenCalledExactlyOnceWith(
      "r1",
      "g1",
      "milk",
      weekly,
      undefined,
      undefined
    );
  });

  it("deletes a repeating grocery's repeat, and a plain grocery itself", () => {
    renderHook(() => useGroceryEdit(grocery, recurring)).result.current.remove();
    expect(mutations.deleteRecurringGrocery).toHaveBeenCalledExactlyOnceWith("r1");

    renderHook(() => useGroceryEdit(grocery, null)).result.current.remove();
    expect(mutations.deleteGroceries).toHaveBeenCalledExactlyOnceWith(["g1"]);
  });
});
