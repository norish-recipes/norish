import { describe, expect, it } from "vitest";

import { BASE_SPELLING_RULES } from "@norish/shared/lib/spelling-keys";

import { foodNamedAsTyped } from "../food-named-as-typed";

const milk = { id: "i-milk", name: "Milk", localeNames: { nl: "Melk" } };
const cafe = { id: "i-cafe", name: "Café", localeNames: {} };
const onions = { id: "i-onions", name: "Onions", localeNames: {} };

describe("foodNamedAsTyped", () => {
  it("compares the name the row shows, in the viewer's language", () => {
    expect(foodNamedAsTyped("melk", [milk], "nl", BASE_SPELLING_RULES)?.id).toBeDefined();
    expect(foodNamedAsTyped("melk", [milk], "en", BASE_SPELLING_RULES)).toBeUndefined();
  });

  it("ignores case, accents, marks and a note, as the pantry's own match does", () => {
    expect(foodNamedAsTyped("cafe", [cafe], "en", BASE_SPELLING_RULES)?.id).toBeDefined();
    expect(
      foodNamedAsTyped("Onions, diced", [onions], "en", BASE_SPELLING_RULES)?.id
    ).toBeDefined();
    // The rule folds no plural, as `canAdd` does not.
    expect(foodNamedAsTyped("onion", [onions], "en", BASE_SPELLING_RULES)).toBeUndefined();
  });

  it("is false for another food", () => {
    expect(foodNamedAsTyped("oat milk", [milk], "en", BASE_SPELLING_RULES)).toBeUndefined();
  });
});
