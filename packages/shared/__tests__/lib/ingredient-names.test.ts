import { describe, expect, it } from "vitest";

import {
  catalogueLanguagesFor,
  chooseLocaleNames,
  ingredientDisplayName,
} from "@norish/shared/lib/ingredient-names";

describe("ingredientDisplayName", () => {
  const onion = { name: "onion", localeNames: { nl: "ui", de: "Zwiebel", nb: "løk" } };

  it("shows the spelling in the viewer's language", () => {
    expect(ingredientDisplayName(onion, "nl")).toBe("ui");
    expect(ingredientDisplayName(onion, "de-formal")).toBe("Zwiebel");
    expect(ingredientDisplayName(onion, "no")).toBe("løk");
  });

  it("falls back to the Ingredient's own name where there is none", () => {
    expect(ingredientDisplayName(onion, "fr")).toBe("onion");
    expect(ingredientDisplayName({ name: "onion powder" }, "nl")).toBe("onion powder");
  });
});

describe("chooseLocaleNames", () => {
  it("chooses one spelling per language, the same whatever order the aliases come in", () => {
    const aliases = [
      { text: "uien", locale: "nl", seeded: true },
      { text: "ajuin", locale: "nl", seeded: true },
      { text: "ui", locale: "nl", seeded: true },
      { text: "Zwiebeln", locale: "de", seeded: true },
      { text: "Zwiebel", locale: "de", seeded: true },
    ];

    expect(chooseLocaleNames(aliases)).toEqual({ nl: "ui", de: "Zwiebel" });
    expect(chooseLocaleNames([...aliases].reverse())).toEqual({ nl: "ui", de: "Zwiebel" });
  });

  it("prefers the catalogue's spelling to a person's, and skips languages no locale reads", () => {
    expect(
      chooseLocaleNames([
        { text: "ui", locale: "nl", seeded: false },
        { text: "uien", locale: "nl", seeded: true },
        { text: "cebolla", locale: "es", seeded: true },
        { text: "タマネギ", locale: "ja", seeded: true },
        { text: "onion", locale: null, seeded: false },
      ])
    ).toEqual({ nl: "uien", es: "cebolla" });
  });

  it("breaks a tie between spellings of one length alphabetically", () => {
    expect(
      chooseLocaleNames([
        { text: "lauk", locale: "nn", seeded: true },
        { text: "løkk", locale: "nn", seeded: true },
      ])
    ).toEqual({ nn: "lauk" });
  });
});

describe("catalogueLanguagesFor", () => {
  it("reads a regional locale in its base language", () => {
    expect(catalogueLanguagesFor("pt-BR")).toEqual(["pt"]);
    expect(catalogueLanguagesFor("fi")).toEqual(["fi"]);
  });
});
