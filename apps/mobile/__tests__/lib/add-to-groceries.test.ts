import { groceriesStartServings } from "@/lib/add-to-groceries";
import { addToGroceriesRoute } from "@/lib/tab-routes";
import { describe, expect, it } from "vitest";

describe("addToGroceriesRoute", () => {
  it("carries the servings a page shows", () => {
    expect(addToGroceriesRoute("r1", 8).params).toEqual({ recipeId: "r1", servings: "8" });
    expect(addToGroceriesRoute("r1").params).toEqual({ recipeId: "r1" });
  });
});

describe("groceriesStartServings", () => {
  it("starts at the route's servings, else the recipe's", () => {
    expect(groceriesStartServings("8", 4)).toBe(8);
    expect(groceriesStartServings("2.5", 4)).toBe(2.5);
    expect(groceriesStartServings(undefined, 4)).toBe(4);
    expect(groceriesStartServings("abc", 4)).toBe(4);
    expect(groceriesStartServings("0", 4)).toBe(4);
  });
});
