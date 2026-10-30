import { describe, expect, it } from "vitest";

import { foodsToBuy } from "@norish/shared/lib/line-foods";

const line = { id: "l1", ingredientName: "2 el boter en suiker", amount: 2, unit: "el" };
const foods = [
  { ingredientId: "butter", name: "boter" },
  { ingredientId: "sugar", name: "suiker" },
];

describe("foodsToBuy", () => {
  it("gives each food of an and line the line's full amount, under its own name", () => {
    expect(
      foodsToBuy([{ ...line, ingredientId: "butter", joined: "together" as const, foods }])
    ).toMatchObject([
      { id: "l1", lineId: "l1", ingredientId: "butter", ingredientName: "boter", amount: 2 },
      { id: "l1:1", lineId: "l1", ingredientId: "sugar", ingredientName: "suiker", amount: 2 },
    ]);
  });

  it("takes an or line's first food, with the others as what else would do", () => {
    expect(
      foodsToBuy([{ ...line, ingredientId: "butter", joined: "alternatives" as const, foods }])
    ).toEqual([
      expect.objectContaining({
        id: "l1",
        ingredientId: "butter",
        ingredientName: "boter",
        alternativeIds: ["sugar"],
      }),
    ]);
  });

  it("keeps a line naming one food or none as it is", () => {
    const one = { ...line, ingredientId: "butter" };
    const none = { ...line, ingredientId: null };

    expect(foodsToBuy([one, none])).toEqual([
      { ...one, lineId: "l1", alternativeIds: [] },
      { ...none, lineId: "l1", alternativeIds: [] },
    ]);
  });
});
