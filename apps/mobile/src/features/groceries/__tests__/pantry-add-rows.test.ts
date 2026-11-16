import { describe, expect, it } from "vitest";

import { BASE_SPELLING_RULES } from "@norish/shared/lib/spelling-keys";

import { pantryAddRows, pantryAddSubmit } from "../utils/pantry-add-rows";

const RULES = BASE_SPELLING_RULES;
const olives = { id: "i-olives", name: "Olives", localeNames: {} };
const oil = { id: "i-oil", name: "Olive oil", localeNames: {} };
const egg = { id: "i-egg", name: "Egg", localeNames: {} };

describe("pantryAddRows", () => {
  it("lists the catalogue foods, then the typed text as a custom entry", () => {
    const rows = pantryAddRows("oli", [olives, oil], true, "en", RULES);

    expect(rows.map((row) => [row.type, row.foodId])).toEqual([
      ["match", "i-olives"],
      ["match", "i-oil"],
      ["custom", null],
    ]);
    expect(rows.at(-1)).toMatchObject({ name: "oli" });
  });

  it("rounds the first and last row of the one card", () => {
    expect(pantryAddRows("oli", [olives, oil], true, "en", RULES).map((row) => row.edge)).toEqual(
      [
        { top: true, bottom: false },
        { top: false, bottom: false },
        { top: false, bottom: true },
      ]
    );
    expect(pantryAddRows("oli", [olives], false, "en", RULES)[0]?.edge).toEqual({
      top: true,
      bottom: true,
    });
  });

  it("offers no custom entry beside a food that is named as typed", () => {
    expect(pantryAddRows("Olives", [olives], true, "en", RULES).map((row) => row.type)).toEqual([
      "match",
    ]);
  });

  it("offers no custom entry beside a food any of whose names is the text, plurals counted", () => {
    const milk = { id: "i-milk", name: "Milk", localeNames: { nl: "Melk" } };

    expect(pantryAddRows("melk", [milk], true, "nl", RULES).map((row) => row.type)).toEqual([
      "match",
    ]);
    expect(pantryAddRows("milk", [milk], true, "nl", RULES).map((row) => row.type)).toEqual([
      "match",
    ]);
    expect(pantryAddRows("eggs", [egg], true, "en", RULES).map((row) => row.type)).toEqual([
      "match",
    ]);
    expect(
      pantryAddRows(
        "cafe",
        [{ id: "i-cafe", name: "Café", localeNames: {} }],
        true,
        "en",
        RULES
      ).map((r) => r.type)
    ).toEqual(["match"]);
  });

  it("offers no custom entry for text the Pantry already keeps, and nothing for no text", () => {
    expect(pantryAddRows("olives", [olives], false, "en", RULES).map((row) => row.type)).toEqual([
      "match",
    ]);
    expect(pantryAddRows("", [], false, "en", RULES)).toEqual([]);
  });
});

describe("pantryAddSubmit", () => {
  it("keeps the found food named as typed rather than the text beside it", () => {
    const milk = { id: "i-milk", name: "Milk", localeNames: { nl: "Melk" } };

    expect(pantryAddSubmit("melk", [milk], true, "nl", RULES)).toMatchObject({
      ingredientId: "i-milk",
    });
    expect(pantryAddSubmit("eggs", [egg], true, "en", RULES)).toMatchObject({ ingredientId: "i-egg" });
  });

  it("keeps the text when no food is named so and it can be added, else nothing", () => {
    expect(pantryAddSubmit("oli", [olives], true, "en", RULES)).toBe("oli");
    expect(pantryAddSubmit("oli", [olives], false, "en", RULES)).toBeNull();
  });
});
