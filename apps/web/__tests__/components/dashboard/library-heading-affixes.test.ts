/**
 * The heading animates the word that changes, not the whole heading.
 *
 * Which part that is has to be read off the three translated strings, because
 * they stay three complete strings for the translator's sake — so this is the
 * seam that decides whether "Your" stands still in a given language.
 */
import { sharedAffixes } from "@/components/dashboard/library-heading";
import { describe, expect, it } from "vitest";

describe("sharedAffixes", () => {
  it("holds a shared leading word still", () => {
    expect(sharedAffixes(["Your library", "Your recipes", "Your cookbooks"])).toEqual({
      prefix: "Your ",
      suffix: "",
    });
  });

  it("holds a shared trailing word still", () => {
    expect(sharedAffixes(["Alle Rezepte anzeigen", "Alle Bücher anzeigen"])).toEqual({
      prefix: "Alle ",
      suffix: " anzeigen",
    });
  });

  it("never splits a word on a shared run of letters", () => {
    // "co" is shared and "collection"/"cookbooks" would split mid-word.
    expect(sharedAffixes(["collection", "cookbooks"])).toEqual({ prefix: "", suffix: "" });
  });

  it("rolls the whole heading when the strings share nothing", () => {
    expect(sharedAffixes(["Bibliotheek", "Recepten", "Kookboeken"])).toEqual({
      prefix: "",
      suffix: "",
    });
  });

  it("leaves every label something to roll", () => {
    // "Your" is entirely a shared prefix of "Your recipes", so taking it would
    // leave the first label with nothing to animate.
    expect(sharedAffixes(["Your", "Your recipes"])).toEqual({ prefix: "", suffix: "" });
  });
});
