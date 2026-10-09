import { describe, expect, it } from "vitest";

import type { UnitsMap } from "@norish/config/zod/server-config";
import defaultUnits from "@norish/config/units.default.json";
import { lineFoodText, namesNoFood } from "@norish/shared/lib/ingredient-text";

const units = defaultUnits as UnitsMap;

/** The text a line's food is read from, by the default units map. */
const food = (text: string, amount: number | string | null, unit: string | null = null) =>
  lineFoodText({ text, amount, unit }, units);

describe("ingredient text", () => {
  it("names no food in a heading, punctuation alone or an old import's object", () => {
    expect(namesNoFood("# For the sauce")).toBe(true);
    expect(namesNoFood(")")).toBe(true);
    expect(namesNoFood("[object Object]")).toBe(true);
    expect(namesNoFood("onions")).toBe(false);
  });

  it("names no food in an amount alone: a number, a weight or a volume", () => {
    expect(namesNoFood("el")).toBe(true);
    expect(namesNoFood("EL")).toBe(true);
    expect(namesNoFood("1 el")).toBe(true);
    expect(namesNoFood("tl.")).toBe(true);
    expect(namesNoFood("200 g")).toBe(true);
    expect(namesNoFood("200g")).toBe(true);
    expect(namesNoFood("½ cup")).toBe(true);
    expect(namesNoFood("2")).toBe(true);
  });

  it("names a food beside an amount, and in a unit that is no weight or volume", () => {
    expect(namesNoFood("el suiker")).toBe(false);
    expect(namesNoFood("2 eieren")).toBe(false);
    expect(namesNoFood("gram flour")).toBe(false);
    expect(namesNoFood("7up")).toBe(false);
    // Liquorice, and "drop" is a unit too, of no weight or volume.
    expect(namesNoFood("drop")).toBe(false);
  });

  it("reads a line's food past the unit an import left in its text beside the number", () => {
    expect(food("GR CHERRYTOMATEN", 150)).toBe("CHERRYTOMATEN");
    expect(food("rol bladerdeeg", 1)).toBe("bladerdeeg");
    expect(food("krop ijsbergsla", "0.250")).toBe("ijsbergsla");
    expect(food("Teen Knoflook", 1)).toBe("Knoflook");
    expect(food("heaped tablespoons peanut butter", 3)).toBe("peanut butter");
    expect(food("can of chickpeas", 1)).toBe("chickpeas");
  });

  it("reads a line as written where no number stands apart, a unit does, or nothing follows the unit", () => {
    // Alone, a unit word may be the food's own.
    expect(food("glass noodles", null)).toBe("glass noodles");
    expect(food("rol bladerdeeg", "")).toBe("rol bladerdeeg");
    // The line's unit is its own; the text is the food's.
    expect(food("bol mozzarella", 150, "gram")).toBe("bol mozzarella");
    expect(food("eieren", 2)).toBe("eieren");
    expect(food("el", 1)).toBe("el");
    expect(food("onions, diced", 2)).toBe("onions, diced");
  });
});
