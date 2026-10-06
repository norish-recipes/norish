import { firstSlotFrom, nextMealSlot } from "@/components/dashboard/today/todays-meals-helpers";
import { describe, expect, it } from "vitest";

describe("nextMealSlot", () => {
  it("is breakfast until ten, lunch until two, and dinner after", () => {
    expect(nextMealSlot(7)).toBe("Breakfast");
    expect(nextMealSlot(10)).toBe("Lunch");
    expect(nextMealSlot(13)).toBe("Lunch");
    expect(nextMealSlot(14)).toBe("Dinner");
    expect(nextMealSlot(23)).toBe("Dinner");
  });
});

describe("firstSlotFrom", () => {
  it("takes the slot itself, or the next one shown after it", () => {
    expect(firstSlotFrom(["Breakfast", "Lunch", "Dinner", "Snack"], "Dinner")).toBe("Dinner");
    expect(firstSlotFrom(["Breakfast", "Snack"], "Lunch")).toBe("Snack");
  });

  it("has nothing when every slot shown is earlier", () => {
    expect(firstSlotFrom(["Breakfast"], "Dinner")).toBeUndefined();
  });
});
