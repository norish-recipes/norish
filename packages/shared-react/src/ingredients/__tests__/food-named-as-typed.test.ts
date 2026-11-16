import { describe, expect, it } from "vitest";

import { BASE_SPELLING_RULES } from "@norish/shared/lib/spelling-keys";

import { foodNamedAsTyped } from "../food-named-as-typed";

const milk = { id: "i-milk", name: "Milk", localeNames: { nl: "Melk" } };
const egg = { id: "i-egg", name: "Egg", localeNames: {} };
const cafe = { id: "i-cafe", name: "Café", localeNames: {} };
const onions = { id: "i-onions", name: "Onions", localeNames: {} };

describe("foodNamedAsTyped", () => {
  it("matches any of the food's names, whatever language the viewer reads", () => {
    expect(foodNamedAsTyped("melk", [milk], BASE_SPELLING_RULES)?.id).toBe("i-milk");
    expect(foodNamedAsTyped("milk", [milk], BASE_SPELLING_RULES)?.id).toBe("i-milk");
  });

  it("counts plurals, case, accents and a note, as the Pantry's own match does", () => {
    expect(foodNamedAsTyped("eggs", [egg], BASE_SPELLING_RULES)?.id).toBe("i-egg");
    expect(foodNamedAsTyped("onion", [onions], BASE_SPELLING_RULES)?.id).toBe("i-onions");
    expect(foodNamedAsTyped("cafe", [cafe], BASE_SPELLING_RULES)?.id).toBe("i-cafe");
    expect(foodNamedAsTyped("Onions, diced", [onions], BASE_SPELLING_RULES)?.id).toBe("i-onions");
  });

  it("is undefined for another food or no text", () => {
    expect(foodNamedAsTyped("oat milk", [milk], BASE_SPELLING_RULES)).toBeUndefined();
    expect(foodNamedAsTyped("", [milk], BASE_SPELLING_RULES)).toBeUndefined();
  });
});
